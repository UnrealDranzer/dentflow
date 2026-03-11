const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if clinic exists and is active
    const [clinics] = await pool.execute(
      'SELECT clinic_id, clinic_name, email, phone, subscription_plan, subscription_status, is_active FROM clinics WHERE clinic_id = ?',
      [decoded.clinic_id]
    );

    if (clinics.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Clinic not found.'
      });
    }

    const clinic = clinics[0];

    if (!clinic.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Clinic account is deactivated.'
      });
    }

    if (clinic.subscription_status === 'suspended') {
      return res.status(401).json({
        success: false,
        message: 'Subscription suspended. Please renew your subscription.'
      });
    }

    // Attach clinic info to request
    req.clinic = {
      clinic_id: clinic.clinic_id,
      clinic_name: clinic.clinic_name,
      email: clinic.email,
      phone: clinic.phone,
      subscription_plan: clinic.subscription_plan,
      subscription_status: clinic.subscription_status
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

// Optional authentication (for public routes that can also access clinic data)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.clinic = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const [clinics] = await pool.execute(
      'SELECT clinic_id, clinic_name, email, subscription_plan FROM clinics WHERE clinic_id = ? AND is_active = true',
      [decoded.clinic_id]
    );

    if (clinics.length > 0) {
      req.clinic = clinics[0];
    }

    next();
  } catch (error) {
    req.clinic = null;
    next();
  }
};

// Check subscription plan
const requireSubscription = (...allowedPlans) => {
  return (req, res, next) => {
    if (!req.clinic) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedPlans.includes(req.clinic.subscription_plan)) {
      return res.status(403).json({
        success: false,
        message: 'This feature requires a higher subscription plan.'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireSubscription
};
