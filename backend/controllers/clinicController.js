const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

// GET /api/clinics/settings
const getSettings = async (req, res) => {
  try {
    const { rows: clinics } = await pool.query(
      `SELECT clinic_id, clinic_name, clinic_slug, email, phone,
              subscription_plan, subscription_status,
              working_hours_start, working_hours_end, working_days, slot_interval_minutes,
              timezone, currency, address, city, state, country, postal_code,
              logo_url, website, google_review_link,
              sms_enabled, whatsapp_enabled, is_active, created_at
       FROM clinics WHERE clinic_id = $1`,
      [req.clinic.clinic_id]
    );
    if (clinics.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found.' });
    }
    res.json({ success: true, data: { clinic: clinics[0] } });
  } catch (err) {
    console.error('getSettings error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
  }
};

// PUT /api/clinics/settings/profile
const updateProfile = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const {
      clinic_name, clinic_slug, phone, address, city, state,
      country, postal_code, website, google_review_link, timezone, logo_url
    } = req.body;

    const fields = [];
    const vals   = [];
    let n = 1;

    const set = (col, val) => { fields.push(`${col} = $${n++}`); vals.push(val); };

    if (clinic_name       !== undefined) set('clinic_name',       clinic_name);
    if (clinic_slug       !== undefined) set('clinic_slug',       clinic_slug);
    if (phone             !== undefined) set('phone',             phone);
    if (address           !== undefined) set('address',           address);
    if (city              !== undefined) set('city',              city);
    if (state             !== undefined) set('state',             state);
    if (country           !== undefined) set('country',           country);
    if (postal_code       !== undefined) set('postal_code',       postal_code);
    if (website           !== undefined) set('website',           website);
    if (google_review_link !== undefined) set('google_review_link', google_review_link);
    if (timezone          !== undefined) set('timezone',          timezone);
    if (logo_url          !== undefined) set('logo_url',          logo_url);

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    set('updated_at', new Date());
    vals.push(clinic_id);

    await pool.query(
      `UPDATE clinics SET ${fields.join(', ')} WHERE clinic_id = $${n}`,
      vals
    );

    const { rows } = await pool.query(
      `SELECT clinic_id, clinic_name, clinic_slug, email, phone, address, city, state,
              country, postal_code, website, google_review_link, timezone, logo_url
       FROM clinics WHERE clinic_id = $1`,
      [clinic_id]
    );

    res.json({ success: true, message: 'Profile updated.', data: { clinic: rows[0] } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Clinic slug is already taken.' });
    }
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

// PUT /api/clinics/settings/working-hours
const updateWorkingHours = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const { working_hours_start, working_hours_end, working_days, slot_interval_minutes } = req.body;

    const fields = [];
    const vals   = [];
    let n = 1;

    const set = (col, val) => { fields.push(`${col} = $${n++}`); vals.push(val); };

    if (working_hours_start  !== undefined) set('working_hours_start',  working_hours_start);
    if (working_hours_end    !== undefined) set('working_hours_end',    working_hours_end);
    if (working_days         !== undefined) set('working_days',         JSON.stringify(working_days));
    if (slot_interval_minutes !== undefined) set('slot_interval_minutes', slot_interval_minutes);

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    set('updated_at', new Date());
    vals.push(clinic_id);

    await pool.query(
      `UPDATE clinics SET ${fields.join(', ')} WHERE clinic_id = $${n}`,
      vals
    );

    res.json({ success: true, message: 'Working hours updated.' });
  } catch (err) {
    console.error('updateWorkingHours error:', err);
    res.status(500).json({ success: false, message: 'Failed to update working hours.' });
  }
};

// PUT /api/clinics/settings/notifications
const updateNotifications = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const { sms_enabled, whatsapp_enabled, google_review_link } = req.body;

    const fields = [];
    const vals   = [];
    let n = 1;

    const set = (col, val) => { fields.push(`${col} = $${n++}`); vals.push(val); };

    if (sms_enabled       !== undefined) set('sms_enabled',       sms_enabled);
    if (whatsapp_enabled  !== undefined) set('whatsapp_enabled',  whatsapp_enabled);
    if (google_review_link !== undefined) set('google_review_link', google_review_link);

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    set('updated_at', new Date());
    vals.push(clinic_id);

    await pool.query(
      `UPDATE clinics SET ${fields.join(', ')} WHERE clinic_id = $${n}`,
      vals
    );

    res.json({ success: true, message: 'Notification settings updated.' });
  } catch (err) {
    console.error('updateNotifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
};

// PUT /api/clinics/settings/password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const { rows } = await pool.query(
      'SELECT password_hash FROM clinics WHERE clinic_id = $1',
      [req.clinic.clinic_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found.' });
    }

    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE clinics SET password_hash = $1, updated_at = NOW() WHERE clinic_id = $2',
      [hash, req.clinic.clinic_id]
    );

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};

module.exports = { getSettings, updateProfile, updateWorkingHours, updateNotifications, changePassword };
