export const subscriptionGuard = (req, res, next) => {
  const { plan, isActive, trialEndsAt, subscriptionEndsAt } = req.clinic;
  
  if (!isActive) {
    return res.status(402).json({ error: 'clinic_inactive', message: 'Clinic account is inactive' });
  }

  const now = new Date();

  // Paid and active
  if (plan !== 'trial' && subscriptionEndsAt && new Date(subscriptionEndsAt) > now) {
    return next();
  }

  // Trial and active
  if (plan === 'trial' && trialEndsAt && new Date(trialEndsAt) > now) {
    const daysLeft = Math.ceil((new Date(trialEndsAt) - now) / (1000 * 60 * 60 * 24));
    res.setHeader('X-Trial-Days-Left', daysLeft.toString());
    return next();
  }

  return res.status(402).json({ 
    error: 'subscription_required', 
    message: 'Subscription expired or trial ended',
    trialEndsAt,
    subscriptionEndsAt
  });
};

export const readOnlyGuard = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(402).json({ error: 'subscription_required', message: 'Read-only mode active. Please upgrade to make changes.' });
  }
  next();
};
