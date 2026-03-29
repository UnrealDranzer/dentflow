import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured on the server');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    const result = await query(
      `SELECT u.id, u.clinic_id, u.email, u.name, u.role, u.is_active as user_active,
              c.plan, c.is_active as clinic_active, c.trial_ends_at, c.subscription_ends_at
       FROM users u
       JOIN clinics c ON u.clinic_id = c.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const row = result.rows[0];

    if (!row.user_active) {
      return res.status(403).json({ error: 'User account is inactive' });
    }

    req.user = {
      id: row.id,
      clinicId: row.clinic_id,
      email: row.email,
      name: row.name,
      role: row.role,
    };

    req.clinic = {
      plan: row.plan,
      isActive: row.clinic_active,
      trialEndsAt: row.trial_ends_at,
      subscriptionEndsAt: row.subscription_ends_at,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(error);
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
