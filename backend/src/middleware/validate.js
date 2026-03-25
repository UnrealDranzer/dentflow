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
  patientId: z.string().uuid('Invalid patient ID'),
  dentistId: z.string().uuid('Invalid dentist ID').optional().or(z.literal(null)),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string()),
  durationMins: z.number().int().positive().default(30),
  type: z.string().optional(),
  notes: z.string().optional(),
  amount: z.number().nonnegative().optional(),
});

export const appointmentUpdateSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().optional(),
  treatmentDone: z.string().optional(),
  amount: z.number().nonnegative().optional(),
});
