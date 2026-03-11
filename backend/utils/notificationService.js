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
    const [clinics] = await pool.execute(
      `SELECT sms_enabled, whatsapp_enabled 
       FROM clinics 
       WHERE clinic_id = ?`,
      [clinic_id]
    );

    if (clinics.length === 0) {
      return;
    }

    const clinic = clinics[0];
    if (!clinic.sms_enabled && !clinic.whatsapp_enabled) {
      return;
    }

    const sendAtExpression = `STR_TO_DATE(CONCAT(?, ' ', ?), '%Y-%m-%d %H:%i:%s') - INTERVAL ? MINUTE`;

    if (clinic.sms_enabled) {
      await pool.execute(
        `INSERT INTO notifications 
          (clinic_id, patient_id, appointment_id, type, purpose, content, status, created_at)
         VALUES (
          ?, ?, ?, 'sms', 'reminder', 'Appointment reminder from your dental clinic', 'pending',
          NOW()
         )`,
        [clinic_id, patient_id, appointment_id]
      );
    }

    if (clinic.whatsapp_enabled) {
      await pool.execute(
        `INSERT INTO notifications 
          (clinic_id, patient_id, appointment_id, type, purpose, content, status, created_at)
         VALUES (
          ?, ?, ?, 'whatsapp', 'reminder', 'Appointment reminder from your dental clinic', 'pending',
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

