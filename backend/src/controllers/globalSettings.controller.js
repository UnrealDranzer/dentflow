import { query } from '../config/db.js';

let cache = {
  billing_enabled: null,
  last_fetch: 0,
};

export const getGlobalBillingStatus = async (req, res, next) => {
  try {
    if (process.env.BILLING_ENABLED === 'false') {
      return res.json({ success: true, billing_enabled: false });
    }

    const { rows } = await query("SELECT value FROM settings WHERE key = 'billing_enabled'");
    const isEnabled = rows.length ? rows[0].value : true;

    res.json({ success: true, billing_enabled: isEnabled });
  } catch (error) {
    next(error);
  }
};

export const updateGlobalBillingStatus = async (req, res, next) => {
  try {
    const { billing_enabled } = req.body;
    
    await query(
      "INSERT INTO settings (key, value) VALUES ('billing_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [billing_enabled]
    );

    // Update cache
    cache.billing_enabled = billing_enabled;
    cache.last_fetch = Date.now();

    res.json({ success: true, billing_enabled });
  } catch (error) {
    next(error);
  }
};

export const checkBillingEnabled = async (req, res, next) => {
  if (process.env.BILLING_ENABLED === 'false') {
    req.billing_disabled = true;
    return next();
  }

  // Use cache if fetched in the last 1 minute
  if (Date.now() - cache.last_fetch < 60000 && cache.billing_enabled !== null) {
    req.billing_disabled = !cache.billing_enabled;
    return next();
  }

  try {
    const { rows } = await query("SELECT value FROM settings WHERE key = 'billing_enabled'");
    const isEnabled = rows.length ? rows[0].value : true;
    
    // Update cache
    cache.billing_enabled = isEnabled;
    cache.last_fetch = Date.now();

    req.billing_disabled = !isEnabled;
    next();
  } catch (error) {
    // If table doesn't exist or error, assume billing is enabled
    req.billing_disabled = false;
    next();
  }
};
