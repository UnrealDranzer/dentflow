-- DentFlow: Add reminder tracking columns to appointments
-- Safe to run multiple times (IF NOT EXISTS / idempotent)

-- 1. Add reminder_sent flag
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- 2. Add timestamp for when reminder was sent
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 3. Partial index for efficient cron lookups
--    Only indexes rows that still need reminders + are upcoming
CREATE INDEX IF NOT EXISTS idx_appts_reminder_pending
  ON appointments (scheduled_at)
  WHERE reminder_sent = false AND status IN ('scheduled', 'confirmed');
