import { query } from '../config/db.js';

export const getSettings = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, website, address, city, 
              state, country, postal_code, google_review_link, 
              booking_slug, logo_url, plan, trial_ends_at, 
              subscription_ends_at
       FROM clinics WHERE id = $1`,
      [req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    res.json({ success: true, data: { settings: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, website, address, city, state, country, postal_code, google_review_link, booking_slug } = req.body;

    if (booking_slug) {
      const slugCheck = await query(
        'SELECT id FROM clinics WHERE booking_slug = $1 AND id != $2',
        [booking_slug, req.clinicId]
      );
      if (slugCheck.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'Slug already taken' });
      }
    }

    const result = await query(
      `UPDATE clinics
       SET name               = COALESCE($1, name),
           phone              = COALESCE($2, phone),
           website            = COALESCE($3, website),
           address            = COALESCE($4, address),
           city               = COALESCE($5, city),
           state              = COALESCE($6, state),
           country            = COALESCE($7, country),
           postal_code        = COALESCE($8, postal_code),
           google_review_link = COALESCE($9, google_review_link),
           booking_slug       = COALESCE($10, booking_slug),
           updated_at         = NOW()
       WHERE id = $11
       RETURNING id, name, email, phone, website, address, city, state, country, postal_code, google_review_link, booking_slug, logo_url, plan, trial_ends_at, subscription_ends_at`,
      [name, phone, website, address, city, state, country, postal_code, google_review_link, booking_slug, req.clinicId]
    );

    res.json({ success: true, data: { settings: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const getPublicClinicBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    // Get clinic info
    const clinicRes = await query(
      `SELECT id, id as clinic_id, name as clinic_name, phone, address, city, state,
              logo_url, google_review_link
       FROM clinics
       WHERE booking_slug = $1 AND is_active = true`,
      [slug]
    );

    if (clinicRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Clinic not found' });
    }

    const clinic = clinicRes.rows[0];

    // Get services and doctors separately (frontend expects them as top-level arrays)
    const [servicesRes, doctorsRes] = await Promise.all([
      query(
        `SELECT id as service_id, id, name as service_name, name,
                description, duration_mins as duration_minutes, duration_mins,
                price, color_code, is_active
         FROM services WHERE clinic_id = $1 AND is_active = true
         ORDER BY name ASC`,
        [clinic.id]
      ),
      query(
        `SELECT id as doctor_id, id, name, specialization,
                phone, email, qualification,
                experience_yrs as experience_years, color_tag
         FROM doctors WHERE clinic_id = $1 AND is_active = true
         ORDER BY name ASC`,
        [clinic.id]
      ),
    ]);

    res.json({
      success: true,
      data: {
        clinic,
        services: servicesRes.rows,
        doctors: doctorsRes.rows,
      }
    });
  } catch (error) {
    next(error);
  }
};
