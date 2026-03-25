-- Phase 2: Add missing tables and columns

-- doctors table --
CREATE TABLE IF NOT EXISTS doctors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  specialization  TEXT,
  phone           TEXT,
  email           TEXT,
  qualification   TEXT,
  experience_yrs  INT,
  color_tag       TEXT DEFAULT '#3B82F6',
  working_days    TEXT[],
  start_time      TEXT,
  end_time        TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON doctors(clinic_id);

-- services table --
CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  duration_mins INT NOT NULL DEFAULT 30,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  color_code    TEXT DEFAULT '#3B82F6',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON services(clinic_id);

-- Add missing columns to clinics for settings page --
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS google_review_link TEXT;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS booking_slug TEXT UNIQUE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS logo_url TEXT;
