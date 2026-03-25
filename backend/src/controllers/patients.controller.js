import { query } from '../config/db.js';

export const getPatients = async (req, res, next) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM patients WHERE clinic_id = $1';
    let countSql = 'SELECT COUNT(*) as exact_count FROM patients WHERE clinic_id = $1';
    const params = [req.clinicId];

    if (search) {
      sql += ' AND (name ILIKE $2 OR phone ILIKE $2)';
      countSql += ' AND (name ILIKE $2 OR phone ILIKE $2)';
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].exact_count, 10);
    const patientsRes = await query(sql, [...params, limit, offset]);

    res.json({ success: true, data: { patients: patientsRes.rows, total } });
  } catch (error) {
    next(error);
  }
};

export const getPatient = async (req, res, next) => {
  try {
    const { id } = req.params;

    const patientRes = await query(
      'SELECT * FROM patients WHERE id = $1 AND clinic_id = $2',
      [id, req.clinicId]
    );

    if (patientRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const appointmentsRes = await query(
      `SELECT a.*, u.name as dentist_name
       FROM appointments a
       LEFT JOIN users u ON a.dentist_id = u.id
       WHERE a.patient_id = $1 AND a.clinic_id = $2
       ORDER BY a.scheduled_at DESC LIMIT 10`,
      [id, req.clinicId]
    );

    res.json({
      success: true,
      data: {
        patient: patientRes.rows[0],
        appointments: appointmentsRes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createPatient = async (req, res, next) => {
  try {
    const { name, phone, email, dob, gender, address, notes } = req.body;

    const result = await query(
      `INSERT INTO patients (clinic_id, name, phone, email, dob, gender, address, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.clinicId, name, phone, email || null, dob || null, gender || null, address || null, notes || null, req.user.id]
    );

    res.status(201).json({ success: true, data: { patient: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const updatePatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, email, dob, gender, address, notes } = req.body;

    const result = await query(
      `UPDATE patients
       SET name       = COALESCE($1, name),
           phone      = COALESCE($2, phone),
           email      = COALESCE($3, email),
           dob        = COALESCE($4, dob),
           gender     = COALESCE($5, gender),
           address    = COALESCE($6, address),
           notes      = COALESCE($7, notes),
           updated_at = NOW()
       WHERE id = $8 AND clinic_id = $9
       RETURNING *`,
      [name, phone, email, dob, gender, address, notes, id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({ success: true, data: { patient: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const deletePatient = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM patients WHERE id = $1 AND clinic_id = $2 RETURNING id',
      [id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    res.json({ success: true, message: 'Patient deleted successfully' });
  } catch (error) {
    next(error);
  }
};
