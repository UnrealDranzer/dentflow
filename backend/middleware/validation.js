const { body, param, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Auth validations
const registerValidation = [
  body('clinic_name')
    .trim()
    .notEmpty().withMessage('Clinic name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Clinic name must be between 2 and 255 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[+]?[\d\s-()]+$/).withMessage('Invalid phone number format'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

// Patient validations
const patientValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Patient name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[+]?[\d\s-()]+$/).withMessage('Invalid phone number format'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('date_of_birth')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  handleValidationErrors
];

// Service validations
const serviceValidation = [
  body('service_name')
    .trim()
    .notEmpty().withMessage('Service name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Service name must be between 2 and 255 characters'),
  body('duration_minutes')
    .notEmpty().withMessage('Duration is required')
    .isInt({ min: 5, max: 480 }).withMessage('Duration must be between 5 and 480 minutes'),
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('description')
    .optional()
    .trim(),
  handleValidationErrors
];

// Appointment validations
const appointmentValidation = [
  body('patient_id')
    .notEmpty().withMessage('Patient is required')
    .isInt().withMessage('Invalid patient ID'),
  body('service_id')
    .notEmpty().withMessage('Service is required')
    .isInt().withMessage('Invalid service ID'),
  body('appointment_date')
    .notEmpty().withMessage('Appointment date is required')
    .isISO8601().withMessage('Invalid date format'),
  body('appointment_time')
    .notEmpty().withMessage('Appointment time is required')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),
  body('notes')
    .optional()
    .trim(),
  handleValidationErrors
];

// Public booking validation
const publicBookingValidation = [
  body('clinic_id')
    .notEmpty().withMessage('Clinic is required')
    .isInt().withMessage('Invalid clinic ID'),
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters'),
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[+]?[\d\s-()]+$/).withMessage('Invalid phone number format'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format'),
  body('service_id')
    .notEmpty().withMessage('Service is required')
    .isInt().withMessage('Invalid service ID'),
  body('appointment_date')
    .notEmpty().withMessage('Appointment date is required')
    .isISO8601().withMessage('Invalid date format'),
  body('appointment_time')
    .notEmpty().withMessage('Appointment time is required')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  patientValidation,
  serviceValidation,
  appointmentValidation,
  publicBookingValidation
};
