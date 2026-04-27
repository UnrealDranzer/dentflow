-- Migration: Add break_start and break_end columns to clinics table
-- These columns allow clinics to define a break period during working hours
-- Slots during break time will be excluded from slot generation

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS break_start TIME DEFAULT NULL;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS break_end   TIME DEFAULT NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clinics'
  AND column_name IN ('break_start', 'break_end');
