import crypto from 'crypto';
import Razorpay from 'razorpay';
import { query } from '../config/db.js';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 1999,
    interval: 'month',
    features: [
      'Up to 200 appointments/month',
      'Patient management',
      'Email support',
      'Basic analytics',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 3999,
    interval: 'month',
    popular: true,
    features: [
      'Unlimited appointments',
      'Patient management',
      'SMS + WhatsApp reminders',
      'Advanced analytics',
      'Priority support',
      'Billing integration',
    ],
  },
];

const PLAN_AMOUNTS = { basic: 199900, pro: 399900 }; // paise

// GET /api/billing/plans  (no auth needed — public pricing)
export const getPlans = async (_req, res) => {
  res.json({ success: true, data: { plans: PLANS } });
};

// GET /api/billing/status
export const getBillingStatus = async (req, res, next) => {
  try {
    const clinicRes = await query(
      `SELECT plan, subscription_status, trial_ends_at, subscription_ends_at
       FROM clinics WHERE id = $1`,
      [req.clinicId]
    );

    if (clinicRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    const clinic = clinicRes.rows[0];
    const now = new Date();

    const trialEndsAt = clinic.trial_ends_at ? new Date(clinic.trial_ends_at) : null;
    const subEndsAt = clinic.subscription_ends_at ? new Date(clinic.subscription_ends_at) : null;

    const isTrial = clinic.subscription_status === 'trial' && trialEndsAt && trialEndsAt > now;
    const isActive =
      clinic.subscription_status === 'active' && subEndsAt && subEndsAt > now;

    const daysRemaining = isTrial
      ? Math.max(0, Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)))
      : isActive
      ? Math.max(0, Math.ceil((subEndsAt - now) / (1000 * 60 * 60 * 24)))
      : null;

    res.json({
      success: true,
      data: {
        status: clinic.subscription_status || 'free',
        plan: clinic.plan || null,
        trial_ends_at: clinic.trial_ends_at || null,
        current_period_end: clinic.subscription_ends_at || null,
        is_trial: isTrial,
        is_active: isActive || isTrial,
        days_remaining: daysRemaining,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/billing/create-order
export const createOrder = async (req, res, next) => {
  try {
    const { plan } = req.body;

    const planAmount = PLAN_AMOUNTS[plan];
    if (!planAmount) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: planAmount,
      currency: 'INR',
      receipt: `rcpt_${req.clinicId}_${Date.now()}`,
      notes: { clinicId: String(req.clinicId), plan },
    });

    await query(
      `INSERT INTO payments (clinic_id, razorpay_order_id, amount, currency, status, plan)
       VALUES ($1, $2, $3, 'INR', 'created', $4)
       ON CONFLICT (razorpay_order_id) DO NOTHING`,
      [req.clinicId, order.id, planAmount / 100, plan]
    );

    res.json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/billing/verify-payment
export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // Mark payment as paid
    await query(
      `UPDATE payments
       SET razorpay_payment_id = $1, razorpay_signature = $2, status = 'paid'
       WHERE razorpay_order_id = $3 AND clinic_id = $4`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id, req.clinicId]
    );

    // Activate subscription for 1 month
    const subEndsAt = new Date();
    subEndsAt.setMonth(subEndsAt.getMonth() + 1);

    await query(
      `UPDATE clinics
       SET plan = $1, subscription_status = 'active', subscription_ends_at = $2
       WHERE id = $3`,
      [plan, subEndsAt.toISOString(), req.clinicId]
    );

    res.json({
      success: true,
      data: { plan, subscription_ends_at: subEndsAt },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/billing/webhook  (raw body, no auth)
export const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return res.status(400).send('No signature');

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body) // Buffer from express.raw
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).send('Invalid signature');
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === 'payment.failed') {
      const orderId = event.payload?.payment?.entity?.order_id;
      if (orderId) {
        await query(
          `UPDATE payments SET status = 'failed' WHERE razorpay_order_id = $1`,
          [orderId]
        );
        // Mark clinic as past_due
        await query(
          `UPDATE clinics SET subscription_status = 'past_due'
           WHERE id = (SELECT clinic_id FROM payments WHERE razorpay_order_id = $1 LIMIT 1)`,
          [orderId]
        );
      }
    }

    res.json({ received: true });
  } catch {
    res.status(500).send('Webhook error');
  }
};
