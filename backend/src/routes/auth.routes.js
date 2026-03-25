import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, login, getMe } from '../controllers/auth.controller.js';
import { validate, signupSchema, loginSchema } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts, please try again later' }
});

router.post('/signup', authLimiter, validate(signupSchema), signup);
router.post('/register', authLimiter, validate(signupSchema), signup);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', authenticate, getMe);

export default router;
