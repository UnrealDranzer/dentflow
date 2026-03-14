const { pool } = require("../config/database");

// Basic notification queuing for SMS / WhatsApp reminders.
// This does NOT send messages directly; it inserts rows into the
// `notifications` table so a separate worker/cron job can deliver them.

const REMINDER_LEAD_MINUTES = parseInt(process.env.REMINDER_LEAD_MINUTES || "60", 10);

const queueAppointmentReminders = async ({
  clinic_id,
  patient_id,
  appointment_id,
  appointment_date,
  appointment_time,
}) => {
  try {
    const { rows: clinics } = await pool.query(
      `SELECT sms_enabled, whatsapp_enabled 
       FROM clinics 
       WHERE clinic_id = $1`,
      [clinic_id]
    );

    if (clinics.length === 0) {
      return;
    }

    const clinic = clinics[0];
    if (!clinic.sms_enabled && !clinic.whatsapp_enabled) {
      return;
    }

    if (clinic.sms_enabled) {
      await pool.query(
        `INSERT INTO notifications 
          (clinic_id, patient_id, appointment_id, type, purpose, content, status, created_at)
         VALUES (
          $1, $2, $3, 'sms', 'reminder', 'Appointment reminder from your dental clinic', 'pending',
          NOW()
         )`,
        [clinic_id, patient_id, appointment_id]
      );
    }

    if (clinic.whatsapp_enabled) {
      await pool.query(
        `INSERT INTO notifications 
          (clinic_id, patient_id, appointment_id, type, purpose, content, status, created_at)
         VALUES (
          $1, $2, $3, 'whatsapp', 'reminder', 'Appointment reminder from your dental clinic', 'pending',
          NOW()
         )`,
        [clinic_id, patient_id, appointment_id]
      );
    }
  } catch (error) {
    console.error("Queue reminder notification error:", error);
  }
};

module.exports = {
  queueAppointmentReminders,
};

