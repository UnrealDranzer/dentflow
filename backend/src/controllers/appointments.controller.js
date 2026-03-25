import { query, withTransaction } from '../config/db.js';

export const getAppointments = async (req, res, next) => {
  try {
    const { date, dentistId, status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT a.*, p.name as patient_name, u.name as dentist_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.dentist_id = u.id
      WHERE a.clinic_id = $1
    `;
    const params = [req.clinicId];

    if (date) {
      sql += ` AND a.scheduled_at >= $${params.length + 1}::date AND a.scheduled_at < $${params.length + 1}::date + INTERVAL '1 day'`;
      params.push(date);
    }
    if (dentistId) {
      sql += ` AND a.dentist_id = $${params.length + 1}`;
      params.push(dentistId);
    }
    if (status) {
      sql += ` AND a.status = $${params.length + 1}`;
      params.push(status);
    }

    sql += ` ORDER BY a.scheduled_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);
    res.json({ 
      success: true, 
      data: { 
        appointments: (result.rows || []).map(r => ({ ...r, id: String(r.id), appointment_id: String(r.id) })) 
      } 
    });
  } catch (error) {
    next(error);
  }
};

export const getTodayAppointments = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.*, p.name as patient_name, u.name as dentist_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.dentist_id = u.id
       WHERE a.clinic_id = $1
         AND a.scheduled_at >= CURRENT_DATE
         AND a.scheduled_at < CURRENT_DATE + INTERVAL '1 day'
         AND a.status != 'cancelled'
       ORDER BY a.scheduled_at ASC`,
      [req.clinicId]
    );
    res.json({ 
      success: true, 
      data: { 
        appointments: (result.rows || []).map(r => ({ ...r, id: String(r.id), appointment_id: String(r.id) })) 
      } 
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.*, p.name as patient_name, p.phone as patient_phone,
              u.name as dentist_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       LEFT JOIN users u ON a.dentist_id = u.id
       WHERE a.id = $1 AND a.clinic_id = $2`,
      [id, req.clinicId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, data: { appointment: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req, res, next) => {
  try {
    const { patientId, dentistId, scheduledAt, durationMins, type, notes, amount } = req.body;

    // Verify patient belongs to this clinic
    const patientCheck = await query(
      'SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
      [patientId, req.clinicId]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Patient not found in this clinic' });
    }

    // Verify dentist belongs to this clinic
    if (dentistId) {
      const dentistCheck = await query(
        "SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'dentist'",
        [dentistId, req.clinicId]
      );
      if (dentistCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Dentist not found or invalid role' });
      }
    }

    const appointment = await withTransaction(async (client) => {
      // Prevent double-booking with SELECT FOR UPDATE
      if (dentistId && scheduledAt) {
        const slotCheck = await client.query(
          `SELECT id FROM appointments
           WHERE dentist_id = $1 AND scheduled_at = $2
           AND status NOT IN ('cancelled', 'no_show')
           FOR UPDATE`,
          [dentistId, scheduledAt]
        );
        if (slotCheck.rows.length > 0) {
          const err = new Error('This time slot is already booked');
          err.status = 409;
          throw err;
        }
      }

      const insertRes = await client.query(
        `INSERT INTO appointments
         (clinic_id, patient_id, dentist_id, scheduled_at, duration_mins, status, type, notes, amount, created_by)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9) RETURNING *`,
        [req.clinicId, patientId, dentistId || null, scheduledAt, durationMins || 30, type || null, notes || null, amount || null, req.user.id]
      );
      return insertRes.rows[0];
    });

    res.status(201).json({ success: true, data: { appointment } });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, treatmentDone, amount } = req.body;

    const result = await query(
      `UPDATE appointments
       SET status         = COALESCE($1, status),
           notes          = COALESCE($2, notes),
           treatment_done = COALESCE($3, treatment_done),
           amount         = COALESCE($4, amount),
           updated_at     = NOW()
       WHERE id = $5 AND clinic_id = $6
       RETURNING *`,
      [status, notes, treatmentDone, amount, id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, data: { appointment: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND clinic_id = $2 RETURNING *`,
      [id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, data: { appointment: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};
