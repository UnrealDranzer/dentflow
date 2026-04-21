import { query } from '../config/db.js';

export const getDoctors = async (req, res, next) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    let sql = `SELECT id as doctor_id, id, clinic_id, name, specialization,
                      phone, email, qualification, experience_yrs as experience_years,
                      color_tag, working_days, start_time, end_time,
                      break_start, break_end, slot_interval,
                      is_active, created_at, updated_at
               FROM doctors WHERE clinic_id = $1`;
    const params = [req.clinicId];

    if (activeOnly) {
      sql += ' AND is_active = true';
    }

    sql += ' ORDER BY name ASC';

    const result = await query(sql, params);
    res.json({ success: true, data: { doctors: result.rows } });
  } catch (error) {
    next(error);
  }
};

export const getDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT id as doctor_id, id, clinic_id, name, specialization,
              phone, email, qualification, experience_yrs as experience_years,
              color_tag, working_days, start_time, end_time,
              break_start, break_end, slot_interval,
              is_active, created_at, updated_at
       FROM doctors WHERE id = $1 AND clinic_id = $2`,
      [id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.json({ success: true, data: { doctor: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const createDoctor = async (req, res, next) => {
  try {
    const { specialization, phone, email, color_tag, working_days, start_time, end_time, break_start, break_end, slot_interval } = req.body;
    const name = (req.body.name || '').trim();
    const qualification = (req.body.qualification || '').trim();
    // Accept both frontend (experience_years) and DB (experience_yrs) field names
    const experience_yrs = req.body.experience_yrs || req.body.experience_years || null;

    if (!name) return res.status(400).json({ success: false, message: 'Doctor name is required' });

    const result = await query(
      `INSERT INTO doctors (clinic_id, name, specialization, phone, email, qualification, experience_yrs, color_tag, working_days, start_time, end_time, break_start, break_end, slot_interval)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id as doctor_id, id, clinic_id, name, specialization,
                 phone, email, qualification, experience_yrs as experience_years,
                 color_tag, working_days, start_time, end_time,
                 break_start, break_end, slot_interval,
                 is_active, created_at, updated_at`,
      [req.clinicId, name, (specialization || '').trim() || null, phone || null, email || null, qualification || null, experience_yrs, color_tag || '#3B82F6', working_days || null, start_time || null, end_time || null, break_start || null, break_end || null, slot_interval || 30]
    );

    res.status(201).json({ success: true, data: { doctor: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const updateDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { specialization, phone, email, color_tag, working_days, start_time, end_time, break_start, break_end, slot_interval, is_active } = req.body;
    const name = req.body.name !== undefined ? (req.body.name || '').trim() : undefined;
    const qualification = req.body.qualification !== undefined ? (req.body.qualification || '').trim() : undefined;
    const experience_yrs = req.body.experience_yrs || req.body.experience_years;

    const result = await query(
      `UPDATE doctors
       SET name           = COALESCE($1, name),
           specialization = COALESCE($2, specialization),
           phone          = COALESCE($3, phone),
           email          = COALESCE($4, email),
           qualification  = COALESCE($5, qualification),
           experience_yrs = COALESCE($6, experience_yrs),
           color_tag      = COALESCE($7, color_tag),
           working_days   = COALESCE($8, working_days),
           start_time     = COALESCE($9, start_time),
           end_time       = COALESCE($10, end_time),
           break_start     = COALESCE($11, break_start),
           break_end       = COALESCE($12, break_end),
           slot_interval   = COALESCE($13, slot_interval),
           is_active      = COALESCE($14, is_active),
           updated_at     = NOW()
       WHERE id = $15 AND clinic_id = $16
       RETURNING id as doctor_id, id, clinic_id, name, specialization,
                 phone, email, qualification, experience_yrs as experience_years,
                 color_tag, working_days, start_time, end_time,
                 break_start, break_end, slot_interval,
                 is_active, created_at, updated_at`,
      [name, specialization, phone, email, qualification, experience_yrs, color_tag, working_days, start_time, end_time, break_start, break_end, slot_interval, is_active, id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.json({ success: true, data: { doctor: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const deleteDoctor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE doctors SET is_active = false, updated_at = NOW() WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.json({ success: true, data: { message: 'Doctor deactivated' } });
  } catch (error) {
    next(error);
  }
};
