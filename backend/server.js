const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
if (process.env.NODE_ENV !== 'production') {
  require("dotenv").config();
}

const { testConnection, initDB } = require("./config/database");

const authRoutes        = require("./routes/authRoutes");
const patientRoutes     = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const serviceRoutes     = require("./routes/serviceRoutes");
const analyticsRoutes   = require("./routes/analyticsRoutes");
const publicRoutes      = require("./routes/publicRoutes");
const doctorRoutes      = require("./routes/doctorRoutes");
const clinicRoutes      = require("./routes/clinicRoutes");

const app = express();

// Trust proxy for Render deployment (correctly identifies client IP behind proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// CORS – restrict in production via CORS_ORIGIN env variable
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Rate limiting for sensitive/public endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicBookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "DentFlow API Running", version: "2.0" });
});

app.use("/api/auth",         authLimiter, authRoutes);
app.use("/api/patients",     patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services",     serviceRoutes);
app.use("/api/analytics",    analyticsRoutes);
app.use("/api/public",       publicBookingLimiter, publicRoutes);
app.use("/api/doctors",      doctorRoutes);
app.use("/api/clinics",      clinicRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;

// Start server: test DB connection, auto-init schema if needed, then listen
async function start() {
  await testConnection();
  await initDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();