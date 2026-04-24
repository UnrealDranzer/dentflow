import pool from '../config/db.js';
import logger from '../utils/logger.js';
import twilio from 'twilio';

const MessagingResponse = twilio.twiml.MessagingResponse;

/**
 * Handle incoming WhatsApp messages from Twilio webhook.
 *
 * POST /api/webhook/whatsapp
 *
 * Twilio sends form-encoded data with fields like:
 *   Body, From, To, MessageSid, NumMedia, etc.
 */
export const handleIncomingMessage = async (req, res) => {
  const twiml = new MessagingResponse();
  
  try {
    const { Body, From } = req.body;

    // Safely extract message and sender
    const message = Body ? Body.trim() : '';
    const sender = From ? From.replace('whatsapp:', '') : '';

    // Log incoming message safely
    logger.info('Incoming WhatsApp message:', { message, sender });
    console.log('Incoming WhatsApp message:', message, sender);

    if (sender && message) {
      // Find latest appointment using sender phone
      const findQuery = `
        SELECT a.id, a.status 
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE p.phone = $1
        ORDER BY a.scheduled_at DESC 
        LIMIT 1
      `;
      const appointmentResult = await pool.query(findQuery, [sender]);

      if (appointmentResult.rows.length > 0) {
        const appointmentId = appointmentResult.rows[0].id;
        let newStatus = null;

        if (message === '1') {
          newStatus = 'confirmed';
          twiml.message("✅ Appointment confirmed. See you soon!");
        } else if (message === '2') {
          newStatus = 'cancelled';
          twiml.message("❌ Appointment cancelled.");
        } else if (message === '3') {
          newStatus = 'reschedule_requested';
          twiml.message("🔄 We will contact you shortly to reschedule.");
        } else {
          twiml.message(
            "Invalid option.\nReply:\n1 → Confirm\n2 → Cancel\n3 → Reschedule"
          );
        }

        if (newStatus) {
          const updateQuery = `
            UPDATE appointments 
            SET status = $1, updated_at = NOW() 
            WHERE id = $2
          `;
          await pool.query(updateQuery, [newStatus, appointmentId]);
          logger.info(`Appointment ${appointmentId} status updated to ${newStatus} via WhatsApp webhook`);
        }
      } else {
        twiml.message("No active appointment found.");
      }
    }

    return res.type('text/xml').send(twiml.toString());
  } catch (error) {
    logger.error('❌ WhatsApp webhook error', { error: error.message });
    // Still return 200 so Twilio doesn't retry endlessly
    return res.status(200).send('<Response></Response>');
  }
};
