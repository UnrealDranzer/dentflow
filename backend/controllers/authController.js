const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * Generate JWT token
 * Uses process.env.JWT_SECRET and process.env.JWT_EXPIRES_IN (defaulting to 7d)
 */
const generateToken = (clinic) => {
  if (!process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET is not set in environment variables!");
  }
  return jwt.sign(
    { 
      clinic_id: clinic.clinic_id,
      email: clinic.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Register new clinic
const register = async (req, res) => {
  try {
    const { clinic_name, email, phone, password } = req.body;

    // Check if email already exists
    const { rows: existingClinics } = await pool.query(
      'SELECT clinic_id FROM clinics WHERE email = $1',
      [email]
    );

    if (existingClinics.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered. Please login or use a different email.'
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert new clinic
    const { rows: result } = await pool.query(
      `INSERT INTO clinics (clinic_name, email, phone, password_hash, subscription_plan) 
       VALUES ($1, $2, $3, $4, 'free')
       RETURNING clinic_id`,
      [clinic_name, email, phone, password_hash]
    );

    const clinic_id = result[0].clinic_id;

    // Get the created clinic
    const { rows: clinics } = await pool.query(
      'SELECT clinic_id, clinic_name, email, phone, subscription_plan, created_at FROM clinics WHERE clinic_id = $1',
      [clinic_id]
    );

    const clinic = clinics[0];
    const token = generateToken(clinic);

    res.status(201).json({
      success: true,
      message: 'Clinic registered successfully',
      data: {
        clinic: {
          clinic_id: clinic.clinic_id,
          clinic_name: clinic.clinic_name,
          email: clinic.email,
          phone: clinic.phone,
          subscription_plan: clinic.subscription_plan,
          created_at: clinic.created_at
        },
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed.'
    });
  }
};

// Login clinic
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find clinic by email
    const { rows: clinics } = await pool.query(
      'SELECT clinic_id, clinic_name, email, phone, password_hash, subscription_plan, subscription_status, is_active FROM clinics WHERE email = $1',
      [email]
    );

    if (clinics.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const clinic = clinics[0];

    if (!clinic.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, clinic.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Update last login
    await pool.query(
      'UPDATE clinics SET last_login_at = NOW() WHERE clinic_id = $1',
      [clinic.clinic_id]
    );

    const token = generateToken(clinic);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        clinic: {
          clinic_id: clinic.clinic_id,
          clinic_name: clinic.clinic_name,
          email: clinic.email,
          phone: clinic.phone,
          subscription_plan: clinic.subscription_plan,
          subscription_status: clinic.subscription_status
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed.'
    });
  }
};

// Get current clinic profile
const getMe = async (req, res) => {
  try {
    const { rows: clinics } = await pool.query(
      `SELECT clinic_id, clinic_name, email, phone, subscription_plan, subscription_status,
              working_hours_start, working_hours_end, working_days, timezone, currency,
              address, city, state, country, postal_code, logo_url, website, google_review_link,
              sms_enabled, whatsapp_enabled, created_at, last_login_at
       FROM clinics WHERE clinic_id = $1`,
      [req.clinic.clinic_id]
    );

    if (clinics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found.'
      });
    }

    res.json({
      success: true,
      data: { clinic: clinics[0] }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clinic profile.'
    });
  }
};

// Update clinic profile
const updateProfile = async (req, res) => {
  try {
    const {
      clinic_name, phone, address, city, state, country, postal_code,
      working_hours_start, working_hours_end, working_days, timezone,
      website, google_review_link
    } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Use strictly PostgreSQL positional parameters ($1, $2...)
    if (clinic_name) { updates.push(`clinic_name = $${paramIndex++}`); values.push(clinic_name); }
    if (phone) { updates.push(`phone = $${paramIndex++}`); values.push(phone); }
    if (address) { updates.push(`address = $${paramIndex++}`); values.push(address); }
    if (city) { updates.push(`city = $${paramIndex++}`); values.push(city); }
    if (state) { updates.push(`state = $${paramIndex++}`); values.push(state); }
    if (country) { updates.push(`country = $${paramIndex++}`); values.push(country); }
    if (postal_code) { updates.push(`postal_code = $${paramIndex++}`); values.push(postal_code); }
    if (working_hours_start) { updates.push(`working_hours_start = $${paramIndex++}`); values.push(working_hours_start); }
    if (working_hours_end) { updates.push(`working_hours_end = $${paramIndex++}`); values.push(working_hours_end); }
    if (working_days) { updates.push(`working_days = $${paramIndex++}`); values.push(JSON.stringify(working_days)); }
    if (timezone) { updates.push(`timezone = $${paramIndex++}`); values.push(timezone); }
    if (website) { updates.push(`website = $${paramIndex++}`); values.push(website); }
    if (google_review_link) { updates.push(`google_review_link = $${paramIndex++}`); values.push(google_review_link); }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    values.push(req.clinic.clinic_id);
    const clinicIdParam = `$${paramIndex}`;

    await pool.query(
      `UPDATE clinics SET ${updates.join(', ')} WHERE clinic_id = ${clinicIdParam}`,
      values
    );

    // Get updated clinic
    const { rows: clinics } = await pool.query(
      `SELECT clinic_id, clinic_name, email, phone, working_hours_start, working_hours_end,
              working_days, timezone, address, city, state, country, website, google_review_link
       FROM clinics WHERE clinic_id = $1`,
      [req.clinic.clinic_id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { clinic: clinics[0] }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const { rows: clinics } = await pool.query(
      'SELECT password_hash FROM clinics WHERE clinic_id = $1',
      [req.clinic.clinic_id]
    );

    if (clinics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found.'
      });
    }

    const isPasswordValid = await bcrypt.compare(current_password, clinics[0].password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    const saltRounds = 10;
    const new_password_hash = await bcrypt.hash(new_password, saltRounds);

    await pool.query(
      'UPDATE clinics SET password_hash = $1 WHERE clinic_id = $2',
      [new_password_hash, req.clinic.clinic_id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password.'
    });
  }
};

// Logout (client-side handles token removal)
const logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout
};
