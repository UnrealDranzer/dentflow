import { Router } from 'express';
import { 
  getDashboardAnalytics, 
  getAppointmentStats, 
  getRevenueAnalytics 
} from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { tenantGuard } from '../middleware/tenantGuard.js';
import { subscriptionGuard } from '../middleware/subscriptionGuard.js';

const router = Router();

const middleware = [authenticate, tenantGuard, subscriptionGuard];

router.get('/dashboard', middleware, getDashboardAnalytics);
router.get('/appointments', middleware, getAppointmentStats);
router.get('/revenue', middleware, getRevenueAnalytics);

export default router;
