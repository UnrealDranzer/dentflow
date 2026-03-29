import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';
import { checkDbConnection } from './config/db.js';

import authRoutes from './routes/auth.routes.js';
import billingRoutes from './routes/billing.routes.js';
import patientsRoutes from './routes/patients.routes.js';
import appointmentsRoutes from './routes/appointments.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

// New routes
import doctorsRoutes from './routes/doctors.routes.js';
import servicesRoutes from './routes/services.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import { getPublicClinicBySlug, getPublicAvailableSlots, createPublicAppointment } from './controllers/settings.controller.js';


import { authenticate } from './middleware/authenticate.js';
import { tenantGuard } from './middleware/tenantGuard.js';
import { subscriptionGuard } from './middleware/subscriptionGuard.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();

// Enable trust proxy for Render deployment
app.set('trust proxy', 1);

// 1. helmet
app.use(helmet());

// 2. compression
app.use(compression());

// 3. cors
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
].filter(Boolean);

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true 
}));

// 4. express.raw for Razorpay webhook
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// 5. express.json
app.use(express.json({ limit: '10kb' }));

// 6. Global rate limit (300 req per 15 min)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests, please try again later' }
});
app.use(globalLimiter);

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await checkDbConnection();
    res.json({ status: 'ok', db: dbStatus });
  } catch (error) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.get('/api/public/clinic/:slug', getPublicClinicBySlug);
app.get('/api/public/available-slots', getPublicAvailableSlots);
app.post('/api/public/book-appointment', createPublicAppointment);
app.get('/api/book/:slug', getPublicClinicBySlug); // Legacy redirect

// Protected routes setup
const protectedMiddleware = [authenticate, tenantGuard, subscriptionGuard];

app.use('/api/patients', protectedMiddleware, patientsRoutes);
app.use('/api/appointments', protectedMiddleware, appointmentsRoutes);
app.use('/api/dashboard', protectedMiddleware, dashboardRoutes);

app.use('/api/doctors', doctorsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/clinics/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);


// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // 1. Validate Environment Variables
    const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
    const missingEnv = requiredEnv.filter(k => !process.env[k]);
    if (missingEnv.length > 0) {
      throw new Error(`CRITICAL STARTUP ERROR: Missing environment variables: ${missingEnv.join(', ')}`);
    }

    // 2. Test Database Connection
    const dbStatus = await checkDbConnection();
    if (dbStatus.status === 'healthy') {
      app.listen(PORT, () => {
        console.log("--------------------------------------------------");
        console.log(`🚀 DENTFLOW BACKEND ONLINE: http://localhost:${PORT}`);
        console.log(`✅ DATABASE: Connected Successfully (Neon SQL)`);
        console.log("--------------------------------------------------");
        logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error("--------------------------------------------------");
    console.error("❌ FATAL: Database connection failed.");
    console.error(error.message);
    console.error("--------------------------------------------------");
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection! Shutting down...', err);
  process.exit(1);
});
