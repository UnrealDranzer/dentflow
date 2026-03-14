const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
if (process.env.NODE_ENV !== 'production') {
  require("dotenv").config();
}

const { testConnection } = require("./config/database");

const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const publicRoutes = require("./routes/publicRoutes");

const app = express();

// Security middleware
app.use(helmet());

// CORS – keep open in dev, restrict in production via env
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
  })
);

app.use(express.json());

// Rate limiting for sensitive/public endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
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
  res.send("Dental SaaS Backend Running");
});

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/public", publicBookingLimiter, publicRoutes);

app.get("/api/public/ping", (req, res) => {
  res.json({ success: true, message: "pong" });
});

const PORT = process.env.PORT || 5000;

// Test database connection early
testConnection();

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log("--- DEBUG INFO ---");
  console.log("DATABASE_URL exists?", !!process.env.DATABASE_URL);
  if (process.env.DATABASE_URL) {
    // Only print the first few characters to verify it's not empty, don't leak full password in Render logs
    console.log("DATABASE_URL starts with:", process.env.DATABASE_URL.substring(0, 15) + "...");
  } else {
    console.log("WARNING: DATABASE_URL IS UNDEFINED!");
  }
  console.log("------------------");
});