import cron from 'node-cron';
import { query } from '../config/db.js';
import { sendWhatsAppMessage } from './whatsappService.js';
import logger from '../utils/logger.js';

// ─── Configuration ─────────────────────────────────────────────
const CRON_SCHEDULE = '*/5 * * * *';        // Every 5 minutes
const LOOKAHEAD_MINUTES = 65;               // 65 min window (covers 1 hour + cron gap)
const DELAY_BETWEEN_SENDS_MS = 1000;        // 1 sec between messages (Twilio sandbox rate limit)

// ─── Helpers ───────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a TIMESTAMPTZ value into human-readable date and time strings.
 * Uses Indian locale / IST by default.
 */
function formatAppointmentDateTime(scheduledAt) {
  const dt = new Date(scheduledAt);
  const dateStr = dt.toLocaleDateString('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  });
  const timeStr = dt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
  return { dateStr, timeStr };
}

// ─── Core: Process Pending Reminders ───────────────────────────
/**
 * Atomic claim-then-send pattern:
 *   1. UPDATE + RETURNING atomically marks appointments as "reminder_sent = true"
 *      and returns them in one query. This prevents any other cron tick from
 *      picking up the same rows.
 *   2. For each claimed appointment, send the WhatsApp message.
 *
 * If the server crashes between claim and send, that reminder is lost (acceptable
 * for v1 — the alternative, duplicate reminders, is worse).
 */
async function processReminders() {
  try {
    // Atomic claim: mark + fetch in one query
    const result = await query(
      `UPDATE appointments a
       SET    reminder_sent    = true,
              reminder_sent_at = NOW()
       FROM   patients p
       WHERE  a.patient_id = p.id
         AND  a.clinic_id  = p.clinic_id
         AND  a.status IN ('scheduled', 'confirmed')
         AND  a.reminder_sent = false
         AND  a.scheduled_at > NOW()
         AND  a.scheduled_at <= NOW() + INTERVAL '${LOOKAHEAD_MINUTES} minutes'
       RETURNING
         a.id,
         a.scheduled_at,
         a.type,
         a.clinic_id,
         p.phone  AS patient_phone,
         p.name   AS patient_name`
    );

    const appointments = result.rows;

    if (appointments.length === 0) {
      return; // Nothing to send — silent exit
    }

    logger.info(`⏰ Reminder cron: ${appointments.length} appointment(s) to remind`);

    for (const appt of appointments) {
      if (!appt.patient_phone) {
        logger.warn(`Skipping reminder for appointment ${appt.id} — no phone number`);
        continue;
      }

      const { dateStr, timeStr } = formatAppointmentDateTime(appt.scheduled_at);

      const message = [
        `⏰ Appointment Reminder`,
        `Hi ${appt.patient_name}, your appointment is coming up!`,
        ``,
        `📅 Date: ${dateStr}`,
        `🕐 Time: ${timeStr}`,
        `🦷 Service: ${appt.type || 'Consultation'}`,
        ``,
        `Clinic: DentFlow`,
        `Please arrive 10 minutes early.`,
      ].join('\n');

      await sendWhatsAppMessage(appt.patient_phone, message);

      logger.info(`📱 Reminder sent → ${appt.patient_name} (appt: ${appt.id}, clinic: ${appt.clinic_id})`);

      // Rate-limit delay between sends
      if (appointments.indexOf(appt) < appointments.length - 1) {
        await sleep(DELAY_BETWEEN_SENDS_MS);
      }
    }

    logger.info(`✅ Reminder cron complete: ${appointments.length} reminder(s) processed`);
  } catch (error) {
    // NEVER crash the server — log and move on
    logger.error('❌ Reminder cron error', {
      error: error.message,
      stack: error.stack,
    });
  }
}

// ─── Start / Stop ──────────────────────────────────────────────
let cronTask = null;

/**
 * Start the reminder cron job.
 * Safe to call multiple times — will not create duplicate schedules.
 */
export function startReminderCron() {
  if (cronTask) {
    logger.warn('Reminder cron already running — skipping duplicate start');
    return;
  }

  cronTask = cron.schedule(CRON_SCHEDULE, processReminders, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
  });

  logger.info(`⏰ Reminder cron started (schedule: ${CRON_SCHEDULE}, lookahead: ${LOOKAHEAD_MINUTES}min)`);
}

/**
 * Stop the reminder cron job (for graceful shutdown).
 */
export function stopReminderCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('⏰ Reminder cron stopped');
  }
}
