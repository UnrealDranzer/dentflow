import logger from '../utils/logger.js';

/**
 * Handle incoming WhatsApp messages from Twilio webhook.
 *
 * POST /api/webhook/whatsapp
 *
 * Twilio sends form-encoded data with fields like:
 *   Body, From, To, MessageSid, NumMedia, etc.
 */
export const handleIncomingMessage = (req, res) => {
  try {
    const { Body: body, From: from, To: to, MessageSid: sid } = req.body;

    logger.info('📩 Incoming WhatsApp message', {
      sid,
      from,
      to,
      body,
    });

    // ───────────────────────────────────────────────
    // TODO: Add business logic here (e.g. auto-reply,
    //       appointment lookup, keyword routing, etc.)
    // ───────────────────────────────────────────────

    // Twilio expects a 200 to acknowledge receipt
    return res.status(200).send('<Response></Response>');
  } catch (error) {
    logger.error('❌ WhatsApp webhook error', { error: error.message });
    // Still return 200 so Twilio doesn't retry endlessly
    return res.status(200).send('<Response></Response>');
  }
};
