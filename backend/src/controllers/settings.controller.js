import { query, withTransaction } from '../config/db.js';

// ─── Slot Helpers (Duplicated for public use to minimize restructuring) ───────
const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
};

const generateTimeSlots = (workingStart, workingEnd, serviceDuration, existing, date, timezone = 'Asia/Kolkata', breakStart, breakEnd, interval) => {
  const slots = [];
  const startMin = timeToMinutes(workingStart);
  const endMin = timeToMinutes(workingEnd);
  const now = new Date();
  const isToday = date === now.toISOString().split('T')[0];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (let t = startMin; t + serviceDuration <= endMin; t += interval) {
    if (isToday && t <= nowMinutes) continue;
    let available = true;
    for (const a of existing) {
      const as = timeToMinutes(a.appointment_time);
      const ae = as + a.duration_mins;
      if (t < ae && t + serviceDuration > as) { available = false; break; }
    }
    slots.push({ time: minutesToTime(t), available });
  }
  return slots;
};

const parseWorkingDays = (val) => {
  if (!val) return [1,2,3,4,5,6];
  try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (_) { return [1,2,3,4,5,6]; }
};


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

export const getPublicAvailableSlots = async (req, res, next) => {
  try {
    const { clinic_id, date, service_id, doctor_id } = req.query;

    if (!clinic_id || !date || !service_id) {
      return res.status(400).json({ success: false, message: 'clinic_id, date, and service_id are required.' });
    }

    let start_time, end_time, working_days, break_start, break_end, slot_interval;
    let timezone = 'Asia/Kolkata';

    if (doctor_id && doctor_id !== 'any') {
      const doctorRes = await query(
        `SELECT working_days, start_time, end_time, is_active
         FROM doctors WHERE id = $1 AND clinic_id = $2`,
        [doctor_id, clinic_id]
      );

      if (doctorRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Doctor not found.' });
      const doctor = doctorRes.rows[0];
      if (!doctor.is_active) return res.json({ success: true, data: { slots: [] } });

      working_days = doctor.working_days;
      start_time = doctor.start_time || '09:00:00';
      end_time = doctor.end_time || '18:00:00';
    } else {
      const clinicRes = await query(
        'SELECT working_hours_start, working_hours_end, working_days, slot_interval_minutes, timezone FROM clinics WHERE id = $1',
        [clinic_id]
      );
      if (clinicRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Clinic not found.' });
      const clinic = clinicRes.rows[0];
      
      working_days = clinic.working_days;
      start_time = clinic.working_hours_start || '09:00:00';
      end_time = clinic.working_hours_end || '18:00:00';
      slot_interval = clinic.slot_interval_minutes;
      timezone = clinic.timezone || 'Asia/Kolkata';
    }

    const wDays = parseWorkingDays(working_days);
    const selectedDay = new Date(date).getDay();
    if (!wDays.includes(selectedDay)) return res.json({ success: true, data: { slots: [], message: 'Clinic or doctor is closed on this day.' } });

    const serviceRes = await query(
      'SELECT duration_mins FROM services WHERE id = $1 AND clinic_id = $2 AND is_active = true',
      [service_id, clinic_id]
    );
    if (serviceRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Service not found.' });
    const duration = serviceRes.rows[0].duration_mins;

    let bookedSql = `
      SELECT scheduled_at::time as appointment_time, duration_mins
      FROM appointments
      WHERE clinic_id = $1 AND scheduled_at::date = $2 AND status IN ('scheduled','confirmed')
    `;
    const bookedParams = [clinic_id, date];
    if (doctor_id && doctor_id !== 'any') {
      bookedSql += ' AND dentist_id = $3';
      bookedParams.push(doctor_id);
    }

    const bookedRes = await query(bookedSql, bookedParams);
    
    const slots = generateTimeSlots(
      start_time, end_time, duration, bookedRes.rows, date, timezone,
      break_start, break_end, slot_interval || 30
    );

    res.json({ success: true, data: { date, slots } });
  } catch (error) {
    next(error);
  }
};

export const createPublicAppointment = async (req, res, next) => {
  try {
    const { clinic_id, name, phone, email, service_id, doctor_id, appointment_date, appointment_time, notes } = req.body;

    if (!clinic_id || !name || !phone || !service_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    const result = await withTransaction(async (client) => {
      // 1. Find or create patient
      let patientRes = await client.query(
        'SELECT id FROM patients WHERE clinic_id = $1 AND phone = $2',
        [clinic_id, phone]
      );

      let patientId;
      if (patientRes.rows.length > 0) {
        patientId = patientRes.rows[0].id;
      } else {
        const newPatient = await client.query(
          'INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1, $2, $3, $4) RETURNING id',
          [clinic_id, name, phone, email || null]
        );
        patientId = newPatient.rows[0].id;
      }

      // 2. Get service duration (safe check)
      const serviceRes = await client.query(
        'SELECT duration_mins FROM services WHERE id = $1 AND clinic_id = $2',
        [service_id, clinic_id]
      );
      if (serviceRes.rows.length === 0) throw new Error('Service not found');
      const duration = serviceRes.rows[0].duration_mins;

      // 3. Create appointment
      const scheduled_at = `${appointment_date} ${appointment_time}`;
      const apptRes = await client.query(
        `INSERT INTO appointments 
         (clinic_id, patient_id, service_id, dentist_id, scheduled_at, duration_mins, status, source, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', 'public', $7)
         RETURNING *`,
        [clinic_id, patientId, service_id, (doctor_id === 'any' ? null : doctor_id), scheduled_at, duration, notes || null]
      );

      return apptRes.rows[0];
    });

    res.status(201).json({ success: true, data: { appointment: result } });
  } catch (error) {
    next(error);
  }
};

