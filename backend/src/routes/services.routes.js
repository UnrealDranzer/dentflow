import { Router } from 'express';
import { getServices, createService, updateService, deleteService } from '../controllers/services.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { subscriptionGuard } from '../middleware/subscriptionGuard.js';

const router = Router();

router.get('/', authenticate, tenantGuard, subscriptionGuard, getServices);
router.post('/', authenticate, tenantGuard, subscriptionGuard, createService);
router.put('/:id', authenticate, tenantGuard, subscriptionGuard, updateService);
router.delete('/:id', authenticate, tenantGuard, subscriptionGuard, requireRole('admin'), deleteService);

export default router;
