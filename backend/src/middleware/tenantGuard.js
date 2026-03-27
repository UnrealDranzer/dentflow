export const tenantGuard = (req, res, next) => {
  if (!req.user || !req.user.clinicId) {
    return res.status(401).json({ error: 'Unauthorized: No clinic context' });
  }

  if (req.body.clinic_id && req.body.clinic_id !== req.user.clinicId) {
    return res.status(403).json({ error: 'Forbidden: Cannot access other clinic data' });
  }

  if (req.params.clinicId && req.params.clinicId !== req.user.clinicId) {
    return res.status(403).json({ error: 'Forbidden: Cannot access other clinic data' });
  }

  req.clinicId = req.user.clinicId;
  next();
};
