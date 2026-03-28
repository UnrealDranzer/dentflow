import { Router } from 'express';
import { 
  getSettings, 
  updateProfile,
  updateWorkingHours,
  updateNotifications,
  changePassword 
} from '../controllers/settings.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { tenantGuard } from '../middleware/tenantGuard.js';

const router = Router();

router.get('/', authenticate, tenantGuard, getSettings);
router.put('/profile', authenticate, tenantGuard, updateProfile);
router.put('/working-hours', authenticate, tenantGuard, updateWorkingHours);
router.put('/notifications', authenticate, tenantGuard, updateNotifications);
router.put('/password', authenticate, tenantGuard, changePassword);

export default router;
