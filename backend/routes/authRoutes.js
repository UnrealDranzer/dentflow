const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { registerValidation, loginValidation } = require("../middleware/validation");

router.post("/login", loginValidation, authController.login);
router.post("/register", registerValidation, authController.register);

module.exports = router;