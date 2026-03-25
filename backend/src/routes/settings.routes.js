import { Router } from 'express';
import { getSettings, updateProfile } from '../controllers/settings.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { tenantGuard } from '../middleware/tenantGuard.js';

const router = Router();

router.get('/', authenticate, tenantGuard, getSettings);
router.put('/profile', authenticate, tenantGuard, updateProfile);

export default router;
