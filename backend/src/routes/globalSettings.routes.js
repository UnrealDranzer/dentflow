import { Router } from 'express';
import { getGlobalBillingStatus, updateGlobalBillingStatus } from '../controllers/globalSettings.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';

const router = Router();

router.get('/billing', authenticate, getGlobalBillingStatus);
router.put('/billing', authenticate, requireRole('admin'), updateGlobalBillingStatus);

export default router;
