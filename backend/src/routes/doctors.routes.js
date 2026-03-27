import { Router } from 'express';
import { getDoctors, getDoctor, createDoctor, updateDoctor, deleteDoctor } from '../controllers/doctors.controller.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { subscriptionGuard } from '../middleware/subscriptionGuard.js';

const router = Router();

router.get('/', authenticate, tenantGuard, subscriptionGuard, getDoctors);
router.get('/:id', authenticate, tenantGuard, subscriptionGuard, getDoctor);
router.post('/', authenticate, tenantGuard, subscriptionGuard, createDoctor);
router.put('/:id', authenticate, tenantGuard, subscriptionGuard, updateDoctor);
router.delete('/:id', authenticate, tenantGuard, subscriptionGuard, requireRole('admin'), deleteDoctor);

export default router;
