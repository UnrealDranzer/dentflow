import { query } from '../config/db.js';

export const getServices = async (req, res, next) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    let sql = `SELECT id as service_id, id, clinic_id, name as service_name, name,
                      description, duration_mins as duration_minutes, duration_mins,
                      price, color_code, is_active, created_at, updated_at
               FROM services WHERE clinic_id = $1`;
    const params = [req.clinicId];

    if (activeOnly) {
      sql += ' AND is_active = true';
    }

    sql += ' ORDER BY name ASC';

    const result = await query(sql, params);
    res.json({ success: true, data: { services: result.rows } });
  } catch (error) {
    next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    // Accept both frontend field names (service_name, duration_minutes) and DB names (name, duration_mins)
    const name = (req.body.name || req.body.service_name || '').trim();
    const description = (req.body.description || '').trim() || null;
    const duration_mins = parseInt(req.body.duration_mins || req.body.duration_minutes, 10) || 30;
    const price = parseFloat(req.body.price) || 0;
    const color_code = req.body.color_code || '#3B82F6';

    if (!name) return res.status(400).json({ success: false, message: 'Service name is required' });
    if (!Number.isInteger(duration_mins) || duration_mins <= 0) return res.status(400).json({ success: false, message: 'Duration must be an integer > 0' });
    if (isNaN(price) || price < 0) return res.status(400).json({ success: false, message: 'Price must be a number >= 0' });

    const result = await query(
      `INSERT INTO services (clinic_id, name, description, duration_mins, price, color_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id as service_id, id, clinic_id, name as service_name, name,
                 description, duration_mins as duration_minutes, duration_mins,
                 price, color_code, is_active, created_at, updated_at`,
      [req.clinicId, name, description, duration_mins, price, color_code]
    );

    res.status(201).json({ success: true, data: { service: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const { id } = req.params;
    const name = (req.body.name || req.body.service_name || '').trim() || undefined;
    const description = req.body.description !== undefined ? (req.body.description || '').trim() : undefined;
    const duration_mins = parseInt(req.body.duration_mins || req.body.duration_minutes, 10) || undefined;
    const price = req.body.price !== undefined ? (parseFloat(req.body.price) || 0) : undefined;
    const color_code = req.body.color_code;
    const is_active = req.body.is_active;

    const result = await query(
      `UPDATE services
       SET name          = COALESCE($1, name),
           description   = COALESCE($2, description),
           duration_mins = COALESCE($3, duration_mins),
           price         = COALESCE($4, price),
           color_code    = COALESCE($5, color_code),
           is_active     = COALESCE($6, is_active),
           updated_at    = NOW()
       WHERE id = $7 AND clinic_id = $8
       RETURNING id as service_id, id, clinic_id, name as service_name, name,
                 description, duration_mins as duration_minutes, duration_mins,
                 price, color_code, is_active, created_at, updated_at`,
      [name, description, duration_mins, price, color_code, is_active, id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, data: { service: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if service has active appointments
    const appointmentCheck = await query(
      `SELECT COUNT(*) as count FROM appointments 
       WHERE service_id = $1 AND clinic_id = $2 AND status IN ('scheduled', 'confirmed')`,
      [id, req.clinicId]
    );
    
    if (parseInt(appointmentCheck.rows[0].count) > 0) {
      // Soft-delete if active appointments exist
      const result = await query(
        'UPDATE services SET is_active = false, updated_at = NOW() WHERE id = $1 AND clinic_id = $2 RETURNING id',
        [id, req.clinicId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }
      return res.json({ success: true, data: { message: 'Service deactivated (has active appointments)' } });
    }

    // Hard delete if no active appointments
    const result = await query(
      'DELETE FROM services WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, data: { message: 'Service deleted' } });
  } catch (error) {
    // If FK constraint prevents deletion, fall back to soft-delete
    if (error.code === '23503') {
      try {
        await query(
          'UPDATE services SET is_active = false, updated_at = NOW() WHERE id = $1 AND clinic_id = $2',
          [id, req.clinicId]
        );
        return res.json({ success: true, data: { message: 'Service deactivated' } });
      } catch (softErr) {
        return next(softErr);
      }
    }
    next(error);
  }
};
