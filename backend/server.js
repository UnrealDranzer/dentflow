const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Load environment variables early
if (process.env.NODE_ENV !== 'production') {
  require("dotenv").config();
}

const { pool, testConnection, initDB } = require("./config/database");

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
// This is critical for express-rate-limit to work correctly on Render
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
  res.json({ 
    success: true, 
    message: "DentFlow API 2.0 (PostgreSQL)", 
    environment: process.env.NODE_ENV 
  });
});

/**
 * Robust Health Check
 * Performs a SELECT NOW() to verify database connectivity
 */
app.get("/api/health", async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: "API and Database are healthy", 
      timestamp: new Date().toISOString(),
      db_time: dbCheck.rows[0].now
    });
  } catch (error) {
    console.error("❌ Health check database failure:", error.message);
    res.status(503).json({ 
      success: false, 
      message: "Database connection failed", 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.use("/api/auth",         authLimiter, authRoutes);
app.use("/api/patients",     patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services",     serviceRoutes);
app.use("/api/analytics",    analyticsRoutes);
app.use("/api/public",       publicBookingLimiter, publicRoutes);
app.use("/api/doctors",      doctorRoutes);
app.use("/api/clinics",      clinicRoutes);

const PORT = process.env.PORT || 5000;

// Start server: test DB connection, auto-init schema if needed, then listen
async function start() {
  console.log("🚀 Starting DentFlow Backend...");
  
  const connected = await testConnection();
  if (connected) {
    await initDB();
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } else {
    console.error("❌ SERVER STARTUP FAILED: Could not connect to database.");
    // In production, we might want to exit so the platform can restart the service
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn("⚠️ Warning: Running server without database connection (Development Mode)");
      app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT} (LIMITED FUNCTIONALITY)`);
      });
    }
  }
}

start();