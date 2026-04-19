import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  sendRegisterOtp,
  verifyRegisterOtp,
  resendRegisterOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPassword,
} from '../controllers/otp.controller.js';
import { validate, registerOtpSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema } from '../middleware/validate.js';

const router = Router();

// Rate limiters — stricter than normal auth
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests, please try again later' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many verification attempts, please try again later' },
});

// ── Registration OTP ──────────────────────────────────────────────────────────
router.post('/register/send-otp', otpSendLimiter, validate(registerOtpSchema), sendRegisterOtp);
router.post('/register/verify-otp', otpVerifyLimiter, validate(verifyOtpSchema), verifyRegisterOtp);
router.post('/register/resend-otp', otpSendLimiter, resendRegisterOtp);

// ── Forgot Password ──────────────────────────────────────────────────────────
router.post('/forgot-password/send-otp', otpSendLimiter, validate(forgotPasswordSchema), sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', otpVerifyLimiter, validate(verifyOtpSchema), verifyForgotPasswordOtp);
router.post('/forgot-password/reset', otpVerifyLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
