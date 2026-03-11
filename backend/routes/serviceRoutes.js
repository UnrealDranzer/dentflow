const express = require("express");
const router = express.Router();

const serviceController = require("../controllers/serviceController");
const { authenticate } = require("../middleware/auth");
const { serviceValidation } = require("../middleware/validation");

// Popular services
router.get("/popular", authenticate, serviceController.getPopularServices);

// Get all services
router.get("/", authenticate, serviceController.getAllServices);

// Get single service
router.get("/:id", authenticate, serviceController.getServiceById);

// Create service
router.post("/", authenticate, serviceValidation, serviceController.createService);

// Update service
router.put("/:id", authenticate, serviceValidation, serviceController.updateService);

// Delete service
router.delete("/:id", authenticate, serviceController.deleteService);

module.exports = router;