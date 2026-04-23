import twilio from 'twilio';
import logger from '../utils/logger.js';

// ─── Twilio Client (lazy singleton) ────────────────────────────
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g. whatsapp:+14155238886

let client = null;

function getClient() {
  if (!client) {
    if (!accountSid || !authToken) {
      logger.warn('⚠️  Twilio credentials missing – WhatsApp messages will be skipped.');
      return null;
    }
    client = twilio(accountSid, authToken);
    logger.info('✅ Twilio client initialised');
  }
  return client;
}

// ─── Phone normaliser ──────────────────────────────────────────
/**
 * Normalise a phone number for WhatsApp delivery.
 *  • Strips spaces, dashes, parentheses
 *  • Removes leading + or 0
 *  • If the remaining digits are 10 chars (Indian mobile), prepends 91
 *
 * Returns a string like "919876543210".
 */
export function normalizePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return '';

  // Strip everything except digits
  let digits = phone.replace(/[^\d]/g, '');

  // If it already has country code (91) and is 12 digits, return as-is
  if (digits.startsWith('91') && digits.length === 12) {
    return digits;
  }

  // Leading 0 trunk prefix
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Bare 10-digit Indian mobile → prepend 91
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // Fallback: return whatever we have
  return digits;
}

// ─── Send WhatsApp message ─────────────────────────────────────
/**
 * Send a WhatsApp message via Twilio Sandbox.
 *
 * @param {string} to      – Recipient number (plain digits, e.g. "919876543210" or "+919876543210")
 * @param {string} message – Message body text
 * @returns {Promise<object|null>} Twilio message SID on success, null on failure
 */
export async function sendWhatsAppMessage(to, message) {
  const twilioClient = getClient();

  if (!twilioClient) {
    logger.warn('Twilio client unavailable – skipping WhatsApp message.');
    return null;
  }

  if (!fromNumber) {
    logger.warn('TWILIO_WHATSAPP_NUMBER not set – skipping WhatsApp message.');
    return null;
  }

  try {
    const normalised = normalizePhoneNumber(to);
    const recipient  = `whatsapp:+${normalised}`;

    const msg = await twilioClient.messages.create({
      from: fromNumber,
      to:   recipient,
      body: message,
    });

    logger.info(`📱 WhatsApp sent → ${recipient}  (SID: ${msg.sid})`);
    return msg;
  } catch (error) {
    // Log but never crash the server
    logger.error(`❌ WhatsApp send failed → ${to}`, {
      error: error.message,
      code:  error.code,
      status: error.status,
    });
    return null;
  }
}
