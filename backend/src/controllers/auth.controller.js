import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../config/db.js';

export const signup = async (req, res, next) => {
  try {
    // Accept both snake_case (from frontend) and camelCase variants
    const clinicName = req.body.clinic_name || req.body.clinicName;
    const name       = req.body.name        || clinicName; // owner name defaults to clinic name
    const { email, password, phone }         = req.body;

    const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await withTransaction(async (client) => {
      const clinicRes = await client.query(
        `INSERT INTO clinics (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
        [clinicName, email, phone || null]
      );
      const clinicId = clinicRes.rows[0].id;

      const userRes = await client.query(
        `INSERT INTO users (clinic_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
        [clinicId, email, passwordHash, name]
      );
      return { clinicId, userId: userRes.rows[0].id };
    });

    const token = jwt.sign({ id: result.userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        clinic: {
          clinic_id: result.clinicId,
          clinic_name: clinicName,
          email,
          phone: phone || null,
          subscription_plan: 'free',
          subscription_status: 'trial',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await query(
      `SELECT u.id, u.clinic_id, u.password_hash, u.name, u.role, u.is_active,
              c.name as clinic_name, c.email as clinic_email, c.phone as clinic_phone,
              c.plan, c.subscription_status, c.trial_ends_at, c.subscription_ends_at
       FROM users u
       JOIN clinics c ON u.clinic_id = c.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const row = result.rows[0];

    if (!row.is_active) {
      return res.status(403).json({ success: false, message: 'Account is inactive' });
    }

    const isValid = await bcrypt.compare(password, row.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: row.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    res.json({
      success: true,
      data: {
        token,
        clinic: {
          clinic_id: row.clinic_id,
          clinic_name: row.clinic_name,
          email: row.clinic_email,
          phone: row.clinic_phone,
          subscription_plan: row.plan,
          subscription_status: row.subscription_status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    // /me route only has authenticate middleware (not tenantGuard),
    // so req.clinicId is undefined. Use req.user.clinicId instead.
    const result = await query(
      `SELECT u.id, u.clinic_id, u.email, u.name, u.role, u.is_active,
              c.name as clinic_name, c.email as clinic_email, c.phone as clinic_phone,
              c.plan, c.subscription_status, c.trial_ends_at, c.subscription_ends_at,
              c.google_review_link, c.sms_enabled, c.whatsapp_enabled
       FROM users u
       JOIN clinics c ON u.clinic_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      data: {
        clinic: {
          clinic_id: row.clinic_id,
          clinic_name: row.clinic_name,
          email: row.clinic_email,
          phone: row.clinic_phone,
          subscription_plan: row.plan,
          subscription_status: row.subscription_status,
          google_review_link: row.google_review_link,
          sms_enabled: row.sms_enabled,
          whatsapp_enabled: row.whatsapp_enabled,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
