import { Router } from 'express';
import { handleWebhook, getBillingStatus, getPlans, createOrder, verifyPayment } from '../controllers/billing.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { tenantGuard } from '../middleware/tenantGuard.js';

const router = Router();

// Webhook — raw body, no auth
router.post('/webhook', handleWebhook);

// Public — no auth needed
router.get('/plans', getPlans);

// Protected
router.get('/status', authenticate, tenantGuard, getBillingStatus);
router.post('/create-order', authenticate, tenantGuard, createOrder);
router.post('/verify-payment', authenticate, tenantGuard, verifyPayment);

export default router;
