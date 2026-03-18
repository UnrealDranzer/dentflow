const { pool } = require('../config/database');
const { queueAppointmentReminders } = require('../utils/notificationService');

const parseWorkingDays = (value) => {
  const fallback = [1, 2, 3, 4, 5, 6];
  if (value == null) return fallback;
  const raw = Buffer.isBuffer(value) ? value.toString('utf8') : value;
  if (Array.isArray(raw)) {
    const days = raw.map(Number).filter(Number.isFinite);
    return days.length ? days : fallback;
  }
  if (typeof raw === 'number') return [raw];
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const days = parsed.map(Number).filter(Number.isFinite);
      return days.length ? days : fallback;
    }
  } catch (_) {}
  const cleaned = trimmed.replace(/^\[|\]$/g, '');
  const days = cleaned.split(/[,\s]+/).map(Number).filter(Number.isFinite);
  return days.length ? days : fallback;
};

const timeToMinutes = (t) => {
  if (!t) return 0;
  const str = typeof t === 'string' ? t : String(t);
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// ─── Get clinic public info by slug or id ────────────────────────────────────
const getClinicPublicInfo = async (req, res) => {
  try {
    const { clinicSlug } = req.params;

    // Support both numeric ID and slug
    const isNumeric = /^\d+$/.test(clinicSlug);
    const whereClause = isNumeric
      ? 'clinic_id = $1'
      : 'clinic_slug = $1';

    const { rows: clinics } = await pool.query(
      `SELECT clinic_id, clinic_name, clinic_slug, phone,
              working_hours_start, working_hours_end, working_days,
              slot_interval_minutes, address, city, state, website, logo_url
       FROM clinics
       WHERE ${whereClause} AND is_active = true AND subscription_status = 'active'`,
      [clinicSlug]
    );

    if (clinics.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found or inactive.' });
    }

    const clinic = clinics[0];

    // Active services
    const { rows: services } = await pool.query(
      'SELECT service_id, service_name, description, duration_minutes, price, color_code FROM services WHERE clinic_id = $1 AND is_active = true ORDER BY service_name',
      [clinic.clinic_id]
    );

    // Active doctors
    const { rows: doctors } = await pool.query(
      `SELECT d.doctor_id, d.name, d.specialization, d.color_tag,
              da.working_days, da.start_time, da.end_time
       FROM doctors d
       LEFT JOIN doctor_availability da ON da.doctor_id = d.doctor_id
       WHERE d.clinic_id = $1 AND d.is_active = true
       ORDER BY d.name`,
      [clinic.clinic_id]
    );

    res.json({ success: true, data: { clinic, services, doctors } });
  } catch (error) {
    console.error('getClinicPublicInfo error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch clinic information.' });
  }
};

// ─── Public booking ──────────────────────────────────────────────────────────
const bookAppointment = async (req, res) => {
  try {
    const { clinic_id, name, phone, email, service_id, doctor_id, appointment_date, appointment_time, notes } = req.body;

    const { rows: clinics } = await pool.query(
      'SELECT clinic_id, working_hours_start, working_hours_end, working_days FROM clinics WHERE clinic_id = $1 AND is_active = true',
      [clinic_id]
    );
    if (clinics.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found or inactive.' });
    }

    const clinic = clinics[0];

    // Check clinic is open on selected day
    const workingDays = parseWorkingDays(clinic.working_days);
    const [yr, mo, dy] = appointment_date.split('-').map(Number);
    const dayOfWeek = new Date(yr, mo - 1, dy).getDay();
    if (!workingDays.includes(dayOfWeek)) {
      return res.status(400).json({ success: false, message: dayOfWeek === 0 ? 'Clinic is closed on Sundays.' : 'Clinic is closed on the selected day.' });
    }

    // Check doctor availability if provided
    if (doctor_id) {
      const { rows: drLeaves } = await pool.query(
        'SELECT id FROM doctor_leaves WHERE doctor_id = $1 AND leave_date = $2',
        [doctor_id, appointment_date]
      );
      if (drLeaves.length > 0) {
        return res.status(400).json({ success: false, message: 'Selected doctor is on leave on this day.' });
      }

      const { rows: avRows } = await pool.query(
        'SELECT working_days FROM doctor_availability WHERE doctor_id = $1',
        [doctor_id]
      );
      if (avRows.length > 0) {
        const drDays = parseWorkingDays(avRows[0].working_days);
        if (!drDays.includes(dayOfWeek)) {
          return res.status(400).json({ success: false, message: 'Selected doctor is not available on this day.' });
        }
      }
    }

    const { rows: services } = await pool.query(
      'SELECT duration_minutes, price FROM services WHERE service_id = $1 AND clinic_id = $2 AND is_active = true',
      [service_id, clinic_id]
    );
    if (services.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found or inactive.' });
    }
    const { duration_minutes, price } = services[0];

    // Check slot availability
    let avQuery = `SELECT appointment_time, duration_minutes FROM appointments
                   WHERE clinic_id = $1 AND appointment_date = $2 AND status IN ('scheduled','confirmed')`;
    let avParams = [clinic_id, appointment_date];
    if (doctor_id) { avQuery += ' AND doctor_id = $3'; avParams.push(doctor_id); }

    const { rows: booked } = await pool.query(avQuery, avParams);
    const reqStart = timeToMinutes(appointment_time);
    const reqEnd   = reqStart + duration_minutes;
    for (const b of booked) {
      const bs = timeToMinutes(b.appointment_time);
      const be = bs + b.duration_minutes;
      if (reqStart < be && reqEnd > bs) {
        return res.status(409).json({ success: false, message: 'This time slot is no longer available. Please select a different time.' });
      }
    }

    // Find or create patient
    let patient_id;
    const { rows: existing } = await pool.query(
      'SELECT patient_id FROM patients WHERE clinic_id = $1 AND phone = $2',
      [clinic_id, phone]
    );
    if (existing.length > 0) {
      patient_id = existing[0].patient_id;
      if (email) {
        await pool.query('UPDATE patients SET email = $1, name = $2, updated_at = NOW() WHERE patient_id = $3', [email, name, patient_id]);
      }
    } else {
      const { rows: newPat } = await pool.query(
        'INSERT INTO patients (clinic_id, name, phone, email) VALUES ($1,$2,$3,$4) RETURNING patient_id',
        [clinic_id, name, phone, email || null]
      );
      patient_id = newPat[0].patient_id;
    }

    // Create appointment
    const { rows: apptResult } = await pool.query(
      `INSERT INTO appointments
         (clinic_id, patient_id, service_id, doctor_id, appointment_date, appointment_time,
          duration_minutes, price, status, notes, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,'public_booking')
       RETURNING appointment_id`,
      [clinic_id, patient_id, service_id, doctor_id || null, appointment_date, appointment_time, duration_minutes, price, notes || null]
    );

    const appointment_id = apptResult[0].appointment_id;

    const { rows: appointments } = await pool.query(
      `SELECT a.*, p.name as patient_name, p.phone as patient_phone, s.service_name, d.name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
       WHERE a.appointment_id = $1`,
      [appointment_id]
    );

    await queueAppointmentReminders({ clinic_id, patient_id, appointment_id, appointment_date, appointment_time });

    res.status(201).json({ success: true, message: 'Appointment booked successfully', data: { appointment: appointments[0] } });
  } catch (error) {
    console.error('bookAppointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to book appointment. Please try again.' });
  }
};

// ─── Public available slots ───────────────────────────────────────────────────
const getPublicAvailableSlots = async (req, res) => {
  try {
    const { clinic_id, date, service_id, doctor_id } = req.query;

    if (!clinic_id || !date || !service_id) {
      return res.status(400).json({ success: false, message: 'clinic_id, date, and service_id are required.' });
    }

    const { rows: clinicRows } = await pool.query(
      'SELECT working_hours_start, working_hours_end, working_days, slot_interval_minutes FROM clinics WHERE clinic_id = $1 AND is_active = true',
      [clinic_id]
    );
    if (clinicRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found.' });
    }

    const clinic = clinicRows[0];
    const workingDays = parseWorkingDays(clinic.working_days);
    const [yr, mo, dy] = date.split('-').map(Number);
    const dayOfWeek = new Date(yr, mo - 1, dy).getDay();

    if (!workingDays.includes(dayOfWeek)) {
      return res.json({
        success: true,
        data: { slots: [], message: dayOfWeek === 0 ? 'Clinic is closed on Sundays.' : 'Clinic is closed on this day.' }
      });
    }

    // If doctor specified, check doctor availability too
    let startTime = clinic.working_hours_start;
    let endTime   = clinic.working_hours_end;
    let breakStart = null, breakEnd = null;

    if (doctor_id) {
      const { rows: leaves } = await pool.query(
        'SELECT id FROM doctor_leaves WHERE doctor_id = $1 AND leave_date = $2',
        [doctor_id, date]
      );
      if (leaves.length > 0) {
        return res.json({ success: true, data: { slots: [], message: 'Doctor is on leave on this day.' } });
      }

      const { rows: avRows } = await pool.query(
        'SELECT working_days, start_time, end_time, break_start, break_end, slot_interval FROM doctor_availability WHERE doctor_id = $1',
        [doctor_id]
      );
      if (avRows.length > 0) {
        const drDays = parseWorkingDays(avRows[0].working_days);
        if (!drDays.includes(dayOfWeek)) {
          return res.json({ success: true, data: { slots: [], message: 'Doctor is not available on this day.' } });
        }
        startTime  = avRows[0].start_time  || startTime;
        endTime    = avRows[0].end_time    || endTime;
        breakStart = avRows[0].break_start || null;
        breakEnd   = avRows[0].break_end   || null;
      }
    }

    const { rows: svc } = await pool.query(
      'SELECT duration_minutes FROM services WHERE service_id = $1 AND clinic_id = $2 AND is_active = true',
      [service_id, clinic_id]
    );
    if (svc.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    let bookedQuery = `SELECT appointment_time, duration_minutes FROM appointments
                       WHERE clinic_id = $1 AND appointment_date = $2 AND status IN ('scheduled','confirmed')`;
    let bookedParams = [clinic_id, date];
    if (doctor_id) { bookedQuery += ' AND doctor_id = $3'; bookedParams.push(doctor_id); }

    const { rows: booked } = await pool.query(bookedQuery, bookedParams);

    const slots = generateTimeSlots(startTime, endTime, svc[0].duration_minutes, booked, date, breakStart, breakEnd, clinic.slot_interval_minutes || 30);

    res.json({ success: true, data: { date, service_duration: svc[0].duration_minutes, slots } });
  } catch (error) {
    console.error('getPublicAvailableSlots error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available slots.' });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateTimeSlots = (workingStart, workingEnd, serviceDuration, existing, date, breakStart = null, breakEnd = null, interval = 30) => {
  const slots    = [];
  const startMin = timeToMinutes(workingStart);
  const endMin   = timeToMinutes(workingEnd);
  const brkStart = breakStart ? timeToMinutes(breakStart) : null;
  const brkEnd   = breakEnd   ? timeToMinutes(breakEnd)   : null;

  const isToday      = date === new Date().toISOString().split('T')[0];
  const nowMinutes   = isToday ? (new Date().getHours() * 60 + new Date().getMinutes()) : 0;

  for (let t = startMin; t + serviceDuration <= endMin; t += interval) {
    if (brkStart !== null && brkEnd !== null && t < brkEnd && t + serviceDuration > brkStart) continue;
    if (isToday && t <= nowMinutes) continue;

    let available = true;
    for (const a of existing) {
      const as = timeToMinutes(a.appointment_time);
      const ae = as + a.duration_minutes;
      if (t < ae && t + serviceDuration > as) { available = false; break; }
    }
    slots.push({ time: minutesToTime(t), end_time: minutesToTime(t + serviceDuration), available });
  }
  return slots;
};

module.exports = { getClinicPublicInfo, bookAppointment, getPublicAvailableSlots };
