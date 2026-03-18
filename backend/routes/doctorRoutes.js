const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  updateAvailability,
  addLeave,
  removeLeave,
  getDoctorAvailableSlots
} = require('../controllers/doctorController');

// All doctor routes require authentication
router.use(authenticate);

router.get('/',           getAllDoctors);
router.get('/:id',        getDoctorById);
router.post('/',          createDoctor);
router.put('/:id',        updateDoctor);
router.delete('/:id',     deleteDoctor);

router.put('/:id/availability',         updateAvailability);
router.post('/:id/leaves',              addLeave);
router.delete('/:id/leaves/:leaveId',   removeLeave);
router.get('/:id/available-slots',      getDoctorAvailableSlots);

module.exports = router;
