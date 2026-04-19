import logger from './logger.js';

/**
 * DentFlow Email Service
 * Uses Resend as the email provider.
 * Falls back gracefully if env vars are missing (logs OTP in dev mode).
 */

let resendClient = null;

const getResendClient = async () => {
  if (resendClient) return resendClient;
  
  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set — emails will be logged to console only');
    return null;
  }

  try {
    const { Resend } = await import('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
  } catch (err) {
    logger.error('Failed to initialize Resend client', err);
    return null;
  }
};

const EMAIL_FROM = () => process.env.EMAIL_FROM || 'DentFlow <onboarding@resend.dev>';

/**
 * Send an email via Resend. Returns true on success, false on failure.
 * Never throws — always fails gracefully.
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    const client = await getResendClient();
    
    if (!client) {
      // Dev fallback: log email content
      logger.info(`📧 [DEV EMAIL] To: ${to} | Subject: ${subject}`);
      logger.info(`📧 [DEV EMAIL] Body preview: ${html.substring(0, 200)}...`);
      return true; // Treat as success in dev so flow continues
    }

    const { data, error } = await client.emails.send({
      from: EMAIL_FROM(),
      to: [to],
      subject,
      html,
    });

    if (error) {
      logger.error('Resend email error', { to, subject, error });
      return false;
    }

    logger.info(`✅ Email sent to ${to} (ID: ${data?.id})`);
    return true;
  } catch (err) {
    logger.error('Email send failed', { to, subject, error: err.message });
    return false;
  }
};

/**
 * Send OTP for email verification during registration
 */
export const sendVerificationOtpEmail = async (email, otp) => {
  const subject = 'DentFlow — Verify your email';
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1e293b; margin-bottom: 8px;">Welcome to DentFlow! 🦷</h2>
      <p style="color: #64748b; font-size: 15px;">Use the code below to verify your email and complete registration:</p>
      <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">${otp}</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #cbd5e1; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  // In dev mode without Resend, also log OTP
  if (!process.env.RESEND_API_KEY) {
    logger.info(`🔑 [DEV OTP] Registration OTP for ${email}: ${otp}`);
  }

  return sendEmail({ to: email, subject, html });
};

/**
 * Send OTP for forgot password flow
 */
export const sendForgotPasswordOtpEmail = async (email, otp) => {
  const subject = 'DentFlow — Password Reset Code';
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #1e293b; margin-bottom: 8px;">Password Reset Request 🔐</h2>
      <p style="color: #64748b; font-size: 15px;">Use the code below to reset your password:</p>
      <div style="background: #fef2f2; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #dc2626;">${otp}</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #cbd5e1; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
  `;

  if (!process.env.RESEND_API_KEY) {
    logger.info(`🔑 [DEV OTP] Forgot password OTP for ${email}: ${otp}`);
  }

  return sendEmail({ to: email, subject, html });
};
