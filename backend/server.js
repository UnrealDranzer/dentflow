const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

if (process.env.NODE_ENV !== 'production') {
  require("dotenv").config();
}

const { testConnection, query } = require("./config/database");

const authRoutes        = require("./routes/authRoutes");
const patientRoutes     = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const serviceRoutes     = require("./routes/serviceRoutes");
const analyticsRoutes   = require("./routes/analyticsRoutes");
const publicRoutes      = require("./routes/publicRoutes");
const doctorRoutes      = require("./routes/doctorRoutes");
const clinicRoutes      = require("./routes/clinicRoutes");

const app = express();

// CRITICAL: Trust proxy for Render deployment - MUST be before any middleware!
app.set("trust proxy", 1);

app.use(helmet());

app.use(
  cors({
    origin: ["https://dentflow-delta.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Handle preflight requests globally
app.options("*", cors());

app.use(express.json());

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
    message: "DentFlow API 2.0 (PostgreSQL Only)", 
    environment: process.env.NODE_ENV 
  });
});

/**
 * Robust Health Check
 */
app.get("/api/health", async (req, res) => {
  try {
    const dbTest = await query("SELECT NOW()");
    const tableInfo = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'patients'
      ORDER BY ordinal_position
    `);
    
    res.json({
      success: true,
      message: "API is healthy",
      timestamp: dbTest.rows[0].now,
      environment: process.env.NODE_ENV,
      database: "Connected",
      patients_schema: tableInfo.rows.map(r => r.column_name)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: err.message
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

async function start() {
  console.log("--------------------------------------------------");
  console.log("🚀 INITIALIZING DENTFLOW BACKEND...");
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log("--------------------------------------------------");
  
  const connected = await testConnection();
  if (connected) {
    app.listen(PORT, () => {
      console.log("--------------------------------------------------");
      console.log(`✅ SERVER ONLINE: http://localhost:${PORT}`);
      console.log(`✅ DATABASE: Connected Successfully`);
      console.log("--------------------------------------------------");
    });
  } else {
    console.error("--------------------------------------------------");
    console.error("❌ FATAL CRITICAL ERROR: Database connection failed.");
    console.error("❌ Server will now terminate (PID:", process.pid, ")");
    console.error("--------------------------------------------------");
    process.exit(1);
  }
}

start();