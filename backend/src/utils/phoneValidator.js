/**
 * DentFlow – Phone Number Validation & Normalization (Backend)
 *
 * Canonical storage format: +91XXXXXXXXXX  (13 chars)
 *
 * Accepted input formats:
 *   • 9876543210          → stored as +919876543210
 *   • +919876543210       → stored as +919876543210
 *   • +91 9876 543210     → stripped & stored as +919876543210
 *   • 91 9876543210       → stripped & stored as +919876543210
 *   • 098765-43210        → stripped & stored as +919876543210
 *
 * Rejected:
 *   • Anything that does not resolve to exactly 10 digits after stripping
 */

const PHONE_10_DIGIT = /^[6-9]\d{9}$/;          // valid Indian mobile
const PHONE_WITH_CC  = /^\+91[6-9]\d{9}$/;      // +91 prefixed

const PHONE_ERROR = 'Enter valid phone number (10 digits or +91XXXXXXXXXX)';

/**
 * Strip all non-digit characters (except leading +).
 * Then normalise common prefixes (0, 91) and return bare 10-digit number.
 */
function stripPhone(raw) {
  if (!raw || typeof raw !== 'string') return '';

  // Keep only digits and optional leading +
  let cleaned = raw.replace(/[^\d+]/g, '');

  // Remove leading + and 91 country code
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length > 10) {
    cleaned = cleaned.slice(2);
  }

  // Remove leading 0 (trunk prefix)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Validate a raw phone string.
 * Returns { valid: boolean, normalized: string, error?: string }
 *
 *  • normalized is always in +91XXXXXXXXXX format when valid.
 *  • When invalid, normalized is the cleaned (but un-prefixed) string.
 */
export function validatePhone(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, normalized: '', error: PHONE_ERROR };
  }

  const trimmed = raw.trim();

  // Fast-pass for already-normalised values
  if (PHONE_WITH_CC.test(trimmed)) {
    return { valid: true, normalized: trimmed };
  }

  const digits = stripPhone(trimmed);

  if (!PHONE_10_DIGIT.test(digits)) {
    return { valid: false, normalized: digits, error: PHONE_ERROR };
  }

  return { valid: true, normalized: `+91${digits}` };
}

/**
 * Normalise phone to canonical +91XXXXXXXXXX format.
 * Throws-free: returns null if invalid.
 */
export function normalizePhone(raw) {
  const result = validatePhone(raw);
  return result.valid ? result.normalized : null;
}

/**
 * Quick boolean check.
 */
export function isValidPhone(raw) {
  return validatePhone(raw).valid;
}

export { PHONE_ERROR };
