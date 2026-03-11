const express = require("express");
const router = express.Router();

const publicController = require("../controllers/publicController");
const { publicBookingValidation } = require("../middleware/validation");

// Get clinic public info and services
router.get("/clinic/:clinic_id", publicController.getClinicPublicInfo);

// Get available slots for public booking
router.get("/available-slots", publicController.getPublicAvailableSlots);

// Book appointment publicly
router.post("/book-appointment", publicBookingValidation, publicController.bookAppointment);

module.exports = router;

