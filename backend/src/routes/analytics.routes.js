import { Router } from 'express';
import { getDashboardAnalytics } from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { subscriptionGuard } from '../middleware/subscriptionGuard.js';

const router = Router();

router.get('/dashboard', authenticate, tenantGuard, subscriptionGuard, getDashboardAnalytics);

export default router;
