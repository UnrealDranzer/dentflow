import { z } from 'zod';

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
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
  phone: z.string().optional(),
}).refine(data => data.clinic_name || data.clinicName, {
  message: "Clinic name is required",
  path: ["clinic_name"]
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const patientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  dob: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
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
