-- DentFlow OTP Migration
-- Creates email_otps table for registration verification and password reset

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('register', 'forgot_password')),
  payload JSONB DEFAULT '{}'::jsonb,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);
CREATE INDEX IF NOT EXISTS idx_email_otps_purpose ON email_otps(purpose);
CREATE INDEX IF NOT EXISTS idx_email_otps_expires ON email_otps(expires_at);
