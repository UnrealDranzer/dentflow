const { pool } = require('../config/database');

// Get all patients for a clinic
const getAllPatients = async (req, res) => {
  try {
    const { search } = req.query;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const clinic_id = req.clinic.clinic_id;

    let query = `SELECT * FROM patients WHERE clinic_id = ?`;
    let params = [clinic_id];

    if (search) {
      query += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [patients] = await pool.execute(query, params);

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

    const [patients] = await pool.execute(
      "SELECT * FROM patients WHERE patient_id = ? AND clinic_id = ?",
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
      name,
      phone,
      email,
      date_of_birth,
      gender,
      address,
      city,
      state,
      postal_code,
      emergency_contact_name,
      emergency_contact_phone,
      medical_history,
      allergies,
      notes
    } = req.body;

    const clinic_id = req.clinic.clinic_id;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required."
      });
    }

    const [existingPatients] = await pool.execute(
      "SELECT patient_id FROM patients WHERE clinic_id = ? AND phone = ?",
      [clinic_id, phone]
    );

    if (existingPatients.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Patient with this phone number already exists."
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO patients
      (clinic_id, name, phone, email, date_of_birth, gender, address, city, state,
       postal_code, emergency_contact_name, emergency_contact_phone, medical_history, allergies, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clinic_id,
        name,
        phone,
        email || null,
        date_of_birth || null,
        gender || null,
        address || null,
        city || null,
        state || null,
        postal_code || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        medical_history || null,
        allergies || null,
        notes || null
      ]
    );

    const [patients] = await pool.execute(
      "SELECT * FROM patients WHERE patient_id = ?",
      [result.insertId]
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

    const { name, phone, email } = req.body;

    await pool.execute(
      `UPDATE patients SET name = ?, phone = ?, email = ?
       WHERE patient_id = ? AND clinic_id = ?`,
      [name, phone, email, id, clinic_id]
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

    await pool.execute(
      "DELETE FROM patients WHERE patient_id = ? AND clinic_id = ?",
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

    const [result] = await pool.execute(
      "SELECT COUNT(*) as total FROM patients WHERE clinic_id = ?",
      [clinic_id]
    );

    res.json({
      success: true,
      data: { total_patients: result[0].total }
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