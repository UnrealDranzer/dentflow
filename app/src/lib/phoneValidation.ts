/**
 * DentFlow – Phone Number Validation & Formatting (Frontend)
 *
 * Accepted formats:
 *   • 9876543210            → valid 10-digit
 *   • +919876543210         → valid with country code
 *   • +91 9876 543210       → spaces stripped automatically
 *   • 91 9876543210         → prefix stripped to 10 digits
 *
 * Storage format (DB): +91XXXXXXXXXX (normalised by backend)
 * Display / input:     User types raw digits, UI shows cleaned value
 */

/**
 * Strips all non-digit characters from input.
 * Handles +91 / 91 prefix removal → returns bare 10-digit string.
 */
export const cleanPhone = (value: string): string => {
  // Remove everything except digits
  let digits = value.replace(/\D/g, '');

  // Strip leading 91 country code if result is > 10 digits
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.substring(2);
  }

  // Limit to 10 digits
  return digits.substring(0, 10);
};

/**
 * Validates a cleaned phone string.
 * Accepts:
 *   - Exactly 10 digits starting with 6-9 (Indian mobile)
 *   - +91 followed by 10 digits starting with 6-9
 */
export const isValidPhone = (value: string): boolean => {
  if (!value) return false;
  const cleaned = cleanPhone(value);
  return /^[6-9]\d{9}$/.test(cleaned);
};

/**
 * Normalises to +91XXXXXXXXXX format for API submission.
 * Returns null if invalid.
 */
export const normalizePhone = (value: string): string | null => {
  const cleaned = cleanPhone(value);
  if (!/^[6-9]\d{9}$/.test(cleaned)) return null;
  return `+91${cleaned}`;
};

/**
 * onChange handler for phone <Input> fields.
 * Strips non-digits and limits to 10 chars.
 * Usage: onChange={e => setPhone(handlePhoneInput(e.target.value))}
 */
export const handlePhoneInput = (value: string): string => {
  return value.replace(/\D/g, '').substring(0, 10);
};

/**
 * Formats a stored phone (+919876543210) for display.
 * Returns "98765 43210" or the raw value if not in expected format.
 */
export const formatPhoneDisplay = (stored: string | null | undefined): string => {
  if (!stored) return '';
  let digits = stored;

  // Strip +91 prefix for display
  if (digits.startsWith('+91')) {
    digits = digits.substring(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.substring(2);
  }

  // Format as XXXXX XXXXX for readability
  if (digits.length === 10) {
    return `${digits.substring(0, 5)} ${digits.substring(5)}`;
  }

  return stored;
};

/** Consistent error message used across all forms */
export const PHONE_ERROR_MESSAGE = 'Enter valid phone number (10 digits or +91XXXXXXXXXX)';
