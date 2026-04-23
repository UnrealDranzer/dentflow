import { Router } from 'express';
import { handleIncomingMessage } from '../controllers/whatsapp.controller.js';

const router = Router();

// Twilio sends POST with form-encoded body — no auth required
router.post('/webhook/whatsapp', handleIncomingMessage);

export default router;
