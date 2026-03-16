const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getSettings,
  updateProfile,
  updateWorkingHours,
  updateNotifications,
  changePassword
} = require('../controllers/clinicController');

router.use(authenticate);

router.get('/settings',                      getSettings);
router.put('/settings/profile',              updateProfile);
router.put('/settings/working-hours',        updateWorkingHours);
router.put('/settings/notifications',        updateNotifications);
router.put('/settings/password',             changePassword);

module.exports = router;
