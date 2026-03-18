const { pool } = require('../config/database');

// Get all patients for a clinic
const getAllPatients = async (req, res) => {
  try {
    const { search } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const clinic_id = req.clinic.clinic_id;

    let query = `SELECT * FROM patients WHERE clinic_id = $1`;
    let params = [clinic_id];

    if (search) {
      query += ` AND (name ILIKE $2 OR phone ILIKE $3 OR email ILIKE $4)`;
      const term = `%${search}%`;
      params.push(term, term, term);
      
      // PostgreSQL LIMIT and OFFSET use positional parameters
      query += ` ORDER BY created_at DESC LIMIT $5 OFFSET $6`;
      params.push(limit, offset);
    } else {
      query += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
      params.push(limit, offset);
    }

    const { rows: patients } = await pool.query(query, params);

    res.json({
      success: true,
      data: { patients }
    });

  } catch (error) {
    console.error("Get patients error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patients."
    });
  }
};

// Get single patient
const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    const { rows: patients } = await pool.query(
      "SELECT * FROM patients WHERE patient_id = $1 AND clinic_id = $2",
      [id, clinic_id]
    );

    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Patient not found."
      });
    }

    res.json({
      success: true,
      data: { patient: patients[0] }
    });
  } catch (error) {
    console.error("Get patient error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patient."
    });
  }
};

// Create new patient
const createPatient = async (req, res) => {
  try {
    const {
      name, phone, email, date_of_birth, gender, address, city, state,
      postal_code, emergency_contact_name, emergency_contact_phone,
      medical_history, allergies, notes
    } = req.body;

    const clinic_id = req.clinic.clinic_id;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required."
      });
    }

    const { rows: existingPatients } = await pool.query(
      "SELECT patient_id FROM patients WHERE clinic_id = $1 AND phone = $2",
      [clinic_id, phone]
    );

    if (existingPatients.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Patient with this phone number already exists."
      });
    }

    const { rows: result } = await pool.query(
      `INSERT INTO patients
      (clinic_id, name, phone, email, date_of_birth, gender, address, city, state,
       postal_code, emergency_contact_name, emergency_contact_phone, medical_history, allergies, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING patient_id`,
      [
        clinic_id, name, phone, email || null, date_of_birth || null, 
        gender || null, address || null, city || null, state || null,
        postal_code || null, emergency_contact_name || null, 
        emergency_contact_phone || null, medical_history || null, 
        allergies || null, notes || null
      ]
    );

    const { rows: patients } = await pool.query(
      "SELECT * FROM patients WHERE patient_id = $1",
      [result[0].patient_id]
    );

    res.status(201).json({
      success: true,
      message: "Patient created successfully",
      data: { patient: patients[0] }
    });
  } catch (error) {
    console.error("Create patient error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create patient."
    });
  }
};

// Update patient
const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;
    const { name, phone, email, date_of_birth, gender, address, city, state, postal_code, medical_history, allergies, notes } = req.body;

    await pool.query(
      `UPDATE patients SET 
        name = $1, phone = $2, email = $3, date_of_birth = $4, gender = $5, 
        address = $6, city = $7, state = $8, postal_code = $9, 
        medical_history = $10, allergies = $11, notes = $12, 
        updated_at = NOW()
       WHERE patient_id = $13 AND clinic_id = $14`,
      [name, phone, email, date_of_birth, gender, address, city, state, postal_code, medical_history, allergies, notes, id, clinic_id]
    );

    res.json({
      success: true,
      message: "Patient updated successfully"
    });
  } catch (error) {
    console.error("Update patient error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update patient."
    });
  }
};

// Delete patient
const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    await pool.query(
      "DELETE FROM patients WHERE patient_id = $1 AND clinic_id = $2",
      [id, clinic_id]
    );

    res.json({
      success: true,
      message: "Patient deleted successfully"
    });
  } catch (error) {
    console.error("Delete patient error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete patient."
    });
  }
};

// Get patient statistics
const getPatientStats = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const { rows: result } = await pool.query(
      "SELECT COUNT(*) as total FROM patients WHERE clinic_id = $1",
      [clinic_id]
    );

    res.json({
      success: true,
      data: { total_patients: parseInt(result[0].total) }
    });
  } catch (error) {
    console.error("Get patient stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patient statistics."
    });
  }
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientStats
};