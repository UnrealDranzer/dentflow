import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, withTransaction } from '../config/db.js';
import { sendVerificationOtpEmail, sendForgotPasswordOtpEmail } from '../utils/emailService.js';
import logger from '../utils/logger.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashOtp = async (otp) => {
  return bcrypt.hash(otp, 10);
};

const verifyOtp = async (otp, hash) => {
  return bcrypt.compare(otp, hash);
};

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

// ─── REGISTRATION OTP FLOW ───────────────────────────────────────────────────

/**
 * POST /api/auth/register/send-otp
 * Validates signup fields, generates OTP, stores temp data, sends email
 */
export const sendRegisterOtp = async (req, res, next) => {
  try {
    const { email, password, phone } = req.body;
    const clinicName = req.body.clinic_name || req.body.clinicName;
    const adminName = req.body.adminName || req.body.name || clinicName;

    // Check for existing user
    const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Hash password for storage in payload
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate and hash OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    // Build payload
    const payload = {
      clinicName,
      adminName,
      phone: phone || null,
      passwordHash,
    };

    // Upsert: delete previous unused OTPs for same email+purpose, then insert
    await query(
      `DELETE FROM email_otps WHERE email = $1 AND purpose = 'register' AND used = false`,
      [email]
    );

    await query(
      `INSERT INTO email_otps (email, otp_hash, purpose, payload, expires_at)
       VALUES ($1, $2, 'register', $3, NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes')`,
      [email, otpHash, JSON.stringify(payload)]
    );

    // Send email
    const sent = await sendVerificationOtpEmail(email, otp);
    if (!sent) {
      return res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again.' });
    }

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register/verify-otp
 * Verifies OTP, creates clinic+user, returns JWT (same shape as login/signup)
 */
export const verifyRegisterOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    // Find latest unused register OTP
    const otpResult = await query(
      `SELECT id, otp_hash, payload, attempts, expires_at
       FROM email_otps
       WHERE email = $1 AND purpose = 'register' AND used = false
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No pending verification found. Please register again.' });
    }

    const otpRow = otpResult.rows[0];

    // Check expiry
    if (new Date(otpRow.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code expired. Please request a new one.' });
    }

    // Check max attempts
    if (otpRow.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new code.' });
    }

    // Increment attempts
    await query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [otpRow.id]);

    // Verify OTP
    const isValid = await verifyOtp(otp, otpRow.otp_hash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    // OTP is valid — create account using existing DentFlow pattern
    const payload = typeof otpRow.payload === 'string' ? JSON.parse(otpRow.payload) : otpRow.payload;

    const result = await withTransaction(async (client) => {
      const clinicRes = await client.query(
        `INSERT INTO clinics (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
        [payload.clinicName, email, payload.phone]
      );
      const clinicId = clinicRes.rows[0].id;

      const userRes = await client.query(
        `INSERT INTO users (clinic_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, 'admin') RETURNING id`,
        [clinicId, email, payload.passwordHash, payload.adminName]
      );

      return { clinicId, userId: userRes.rows[0].id };
    });

    // Mark OTP as used
    await query('UPDATE email_otps SET used = true WHERE id = $1', [otpRow.id]);

    // Clean up old OTPs for this email
    await query(
      `DELETE FROM email_otps WHERE email = $1 AND purpose = 'register' AND id != $2`,
      [email, otpRow.id]
    );

    // Generate JWT (same pattern as auth.controller.js signup)
    const token = jwt.sign({ id: result.userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    // Return EXACT same response shape as existing signup/login
    res.status(201).json({
      success: true,
      data: {
        token,
        clinic: {
          clinic_id: result.clinicId,
          clinic_name: payload.clinicName,
          email,
          phone: payload.phone,
          subscription_plan: 'free',
          subscription_status: 'trial',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register/resend-otp
 * Resends registration OTP with cooldown
 */
export const resendRegisterOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Find existing pending OTP
    const otpResult = await query(
      `SELECT id, payload, created_at
       FROM email_otps
       WHERE email = $1 AND purpose = 'register' AND used = false
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No pending registration found. Please register again.' });
    }

    const otpRow = otpResult.rows[0];

    // Cooldown check
    const lastCreated = new Date(otpRow.created_at);
    const secondsSince = (Date.now() - lastCreated.getTime()) / 1000;
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      const waitSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting a new code`,
      });
    }

    // Generate new OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    // Update existing row
    await query(
      `UPDATE email_otps
       SET otp_hash = $1, attempts = 0, expires_at = NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes', created_at = NOW()
       WHERE id = $2`,
      [otpHash, otpRow.id]
    );

    // Send email
    const sent = await sendVerificationOtpEmail(email, otp);
    if (!sent) {
      return res.status(500).json({ success: false, message: 'Failed to send email. Please try again.' });
    }

    res.json({ success: true, message: 'New verification code sent to your email' });
  } catch (error) {
    next(error);
  }
};

// ─── FORGOT PASSWORD FLOW ────────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password/send-otp
 * Sends password reset OTP (never leaks whether email exists)
 */
export const sendForgotPasswordOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Always return same response to avoid email enumeration
    const genericResponse = { success: true, message: 'If the email exists, a reset code has been sent' };

    // Check if user exists
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // User doesn't exist — return generic success (don't leak info)
      return res.json(genericResponse);
    }

    // Generate OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    // Clean up old forgot_password OTPs
    await query(
      `DELETE FROM email_otps WHERE email = $1 AND purpose = 'forgot_password' AND used = false`,
      [email]
    );

    // Insert new OTP
    await query(
      `INSERT INTO email_otps (email, otp_hash, purpose, expires_at)
       VALUES ($1, $2, 'forgot_password', NOW() + INTERVAL '${OTP_EXPIRY_MINUTES} minutes')`,
      [email, otpHash]
    );

    // Send email (fire and forget for security — always return generic)
    await sendForgotPasswordOtpEmail(email, otp);

    res.json(genericResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password/verify-otp
 * Verifies OTP and returns a short-lived reset token
 */
export const verifyForgotPasswordOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    // Find latest unused forgot_password OTP
    const otpResult = await query(
      `SELECT id, otp_hash, attempts, expires_at
       FROM email_otps
       WHERE email = $1 AND purpose = 'forgot_password' AND used = false
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No pending reset found. Please request a new code.' });
    }

    const otpRow = otpResult.rows[0];

    // Check expiry
    if (new Date(otpRow.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset code expired. Please request a new one.' });
    }

    // Check max attempts
    if (otpRow.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new code.' });
    }

    // Increment attempts
    await query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [otpRow.id]);

    // Verify OTP
    const isValid = await verifyOtp(otp, otpRow.otp_hash);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid reset code' });
    }

    // Mark OTP as used
    await query('UPDATE email_otps SET used = true WHERE id = $1', [otpRow.id]);

    // Generate short-lived reset token (15 minutes)
    const resetToken = jwt.sign(
      { email, purpose: 'password_reset', otpId: otpRow.id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ success: true, resetToken });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password/reset
 * Resets password using the reset token
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword, resetToken } = req.body;

    if (!email || !newPassword || !resetToken) {
      return res.status(400).json({ success: false, message: 'Email, new password, and reset token are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token. Please request a new code.' });
    }

    // Verify email matches token
    if (decoded.email !== email || decoded.purpose !== 'password_reset') {
      return res.status(400).json({ success: false, message: 'Invalid reset token' });
    }

    // Find user and update password
    const userResult = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Hash new password using SAME bcrypt rounds as existing flow
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [passwordHash, email]
    );

    // Clean up all forgot_password OTPs for this email
    await query(
      `DELETE FROM email_otps WHERE email = $1 AND purpose = 'forgot_password'`,
      [email]
    );

    logger.info(`Password reset successfully for ${email}`);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};
