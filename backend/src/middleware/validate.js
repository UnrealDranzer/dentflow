import { z } from 'zod';
import { validatePhone, PHONE_ERROR } from '../utils/phoneValidator.js';

// ─── Phone Validation ─────────────────────────────────────────────────────────
// Custom Zod pipeline: validate with superRefine, then transform to +91 format.
const phoneTransform = z.string()
  .superRefine((val, ctx) => {
    const result = validatePhone(val);
    if (!result.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    }
  })
  .transform((val) => validatePhone(val).normalized);

const optionalPhoneTransform = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : val),
  z.string()
    .superRefine((val, ctx) => {
      const result = validatePhone(val);
      if (!result.valid) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
      }
    })
    .transform((val) => validatePhone(val).normalized)
    .optional()
);

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: result.error.errors.map(e => e.message).join(', '),
      errors: result.error.errors,
    });
  }
  req.body = result.data;
  next();
};

export const signupSchema = z.object({
  clinic_name: z.string().min(1, 'Clinic name is required').optional(),
  clinicName: z.string().min(1, 'Clinic name is required').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: optionalPhoneTransform,
}).refine(data => data.clinic_name || data.clinicName, {
  message: "Clinic name is required",
  path: ["clinic_name"]
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// ─── OTP Schemas ──────────────────────────────────────────────────────────────
export const registerOtpSchema = z.object({
  clinic_name: z.string().min(1, 'Clinic name is required').optional(),
  clinicName: z.string().min(1, 'Clinic name is required').optional(),
  adminName: z.string().min(1, 'Admin name is required').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: optionalPhoneTransform,
}).refine(data => data.clinic_name || data.clinicName, {
  message: "Clinic name is required",
  path: ["clinic_name"]
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^[0-9]{6}$/, 'OTP must be 6 digits'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  resetToken: z.string().min(1, 'Reset token is required'),
});

export const patientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: optionalPhoneTransform,
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const doctorSchema = z.object({
  name: z.string().min(1, 'Doctor name is required'),
  specialization: z.string().optional().or(z.literal('')).or(z.null()),
  phone: optionalPhoneTransform,
  email: z.string().email('Invalid email').optional().or(z.literal('')).or(z.null()),
  qualification: z.string().optional().or(z.literal('')).or(z.null()),
  experience_years: z.number().int().nonnegative().optional().or(z.null()),
  experience_yrs: z.number().int().nonnegative().optional().or(z.null()),
  color_tag: z.string().optional().or(z.null()),
  working_days: z.any().optional(),
  start_time: z.string().optional().or(z.null()),
  end_time: z.string().optional().or(z.null()),
  break_start: z.string().optional().or(z.null()),
  break_end: z.string().optional().or(z.null()),
  slot_interval: z.number().int().positive().optional().or(z.null()),
  is_active: z.boolean().optional(),
});

// Separate schema for doctor updates — all fields optional so partial updates work
export const doctorUpdateSchema = z.object({
  name: z.string().min(1, 'Doctor name is required').optional(),
  specialization: z.string().optional().or(z.literal('')).or(z.null()),
  phone: optionalPhoneTransform,
  email: z.string().email('Invalid email').optional().or(z.literal('')).or(z.null()),
  qualification: z.string().optional().or(z.literal('')).or(z.null()),
  experience_years: z.number().int().nonnegative().optional().or(z.null()),
  experience_yrs: z.number().int().nonnegative().optional().or(z.null()),
  color_tag: z.string().optional().or(z.null()),
  working_days: z.any().optional(),
  start_time: z.string().optional().or(z.null()),
  end_time: z.string().optional().or(z.null()),
  break_start: z.string().optional().or(z.null()),
  break_end: z.string().optional().or(z.null()),
  slot_interval: z.number().int().positive().optional().or(z.null()),
  is_active: z.boolean().optional(),
});

// Service validation schemas
export const serviceSchema = z.object({
  service_name: z.string().min(1, 'Service name is required').optional(),
  name: z.string().min(1, 'Service name is required').optional(),
  description: z.string().optional().or(z.literal('')).or(z.null()),
  duration_minutes: z.number().int().min(1, 'Duration must be at least 1 minute').optional(),
  duration_mins: z.number().int().min(1, 'Duration must be at least 1 minute').optional(),
  price: z.number().min(0, 'Price must be >= 0').optional(),
  color_code: z.string().optional(),
  is_active: z.boolean().optional(),
}).refine(data => data.service_name || data.name, {
  message: 'Service name is required',
  path: ['service_name'],
});

export const appointmentSchema = z.object({
  patient_id: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  service_id: z.string().uuid().optional(),
  serviceId: z.string().uuid().optional(),
  doctor_id: z.string().uuid().optional().or(z.literal('any')).or(z.literal('')),
  dentistId: z.string().uuid().optional().or(z.literal(null)),
  appointment_date: z.string().optional(),
  appointment_time: z.string().optional(),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string()).optional(),
  duration_mins: z.number().int().positive().optional(),
  durationMins: z.number().int().positive().optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
  amount: z.number().nonnegative().optional(),
}).refine(data => (data.patient_id || data.patientId) && (data.service_id || data.serviceId || data.type), {
  message: "Patient and Service are required",
  path: ["patient_id"]
});


export const appointmentUpdateSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().optional(),
  treatmentDone: z.string().optional(),
  amount: z.number().nonnegative().optional(),
});

// Public booking schema — normalises phone to +91 format
export const publicBookingSchema = z.object({
  clinic_id: z.string().min(1, 'Clinic ID is required'),
  name: z.string().min(1, 'Name is required'),
  phone: phoneTransform,
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  service_id: z.string().min(1, 'Service is required'),
  doctor_id: z.string().optional().or(z.literal('any')).or(z.literal('')),
  appointment_date: z.string().min(1, 'Date is required'),
  appointment_time: z.string().min(1, 'Time is required'),
  notes: z.string().optional(),
});

// Settings profile schema — normalises phone
export const settingsProfileSchema = z.object({
  name: z.string().optional(),
  clinic_name: z.string().optional(),
  phone: optionalPhoneTransform,
  website: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  country: z.string().optional().or(z.literal('')),
  postal_code: z.string().optional().or(z.literal('')),
  google_review_link: z.string().optional().or(z.literal('')),
  booking_slug: z.string().optional().or(z.literal('')),
  clinic_slug: z.string().optional().or(z.literal('')),
});
