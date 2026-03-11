const express = require("express");
const router = express.Router();

const analyticsController = require("../controllers/analyticsController");
const { authenticate } = require("../middleware/auth");

// Dashboard overview
router.get("/dashboard", authenticate, analyticsController.getDashboardOverview);

// Appointment analytics
router.get("/appointments", authenticate, analyticsController.getAppointmentStats);

// Revenue analytics
router.get("/revenue", authenticate, analyticsController.getRevenueAnalytics);

// Patient analytics
router.get("/patients", authenticate, analyticsController.getPatientAnalytics);

module.exports = router;