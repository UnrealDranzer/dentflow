const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const { authenticate } = require("../middleware/auth");
const { patientValidation } = require("../middleware/validation");

// Get all patients
router.get("/", authenticate, patientController.getAllPatients);

// Patient statistics
router.get("/stats/summary", authenticate, patientController.getPatientStats);

// Get patient by ID
router.get("/:id", authenticate, patientController.getPatientById);

// Create patient
router.post("/", authenticate, patientValidation, patientController.createPatient);

// Update patient
router.put("/:id", authenticate, patientValidation, patientController.updatePatient);

// Delete patient
router.delete("/:id", authenticate, patientController.deletePatient);

module.exports = router;