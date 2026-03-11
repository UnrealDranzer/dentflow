const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointmentController");
const { authenticate } = require("../middleware/auth");
const { appointmentValidation } = require("../middleware/validation");

// Get available slots
router.get("/available-slots", authenticate, appointmentController.getAvailableSlots);

// Get today's appointments
router.get("/today", authenticate, appointmentController.getTodayAppointments);

// Get upcoming appointments
router.get("/upcoming", authenticate, appointmentController.getUpcomingAppointments);

// Get all appointments
router.get("/", authenticate, appointmentController.getAllAppointments);

// Get single appointment
router.get("/:id", authenticate, appointmentController.getAppointmentById);

// Create appointment
router.post("/", authenticate, appointmentValidation, appointmentController.createAppointment);

// Update appointment
router.put("/:id", authenticate, appointmentValidation, appointmentController.updateAppointment);

// Delete appointment
router.delete("/:id", authenticate, appointmentController.deleteAppointment);

module.exports = router;