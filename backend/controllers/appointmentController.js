const { pool } = require('../config/database');
const { queueAppointmentReminders } = require('../utils/notificationService');

const toSafeInt = (value, fallback) => {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// ─── Get all appointments ────────────────────────────────────────────────────
const getAllAppointments = async (req, res) => {
  try {
    const {
      date, start_date, end_date, status,
      patient_id, doctor_id,
      page = 1, limit = 50
    } = req.query;
    const clinic_id = req.clinic.clinic_id;
    const pageNum   = clamp(toSafeInt(page,  1),   1, 1000000);
    const limitNum  = clamp(toSafeInt(limit, 50),  1, 200);
    const offsetNum = (pageNum - 1) * limitNum;

    let wheres = ['a.clinic_id = $1'];
    let params = [clinic_id];
    let idx = 2;

    if (date)                 { wheres.push(`a.appointment_date = $${idx++}`);             params.push(date); }
    if (start_date && end_date) { wheres.push(`a.appointment_date BETWEEN $${idx++} AND $${idx++}`); params.push(start_date, end_date); }
    if (status)               { wheres.push(`a.status = $${idx++}`);                       params.push(status); }
    if (patient_id)           { wheres.push(`a.patient_id = $${idx++}`);                   params.push(patient_id); }
    if (doctor_id)            { wheres.push(`a.doctor_id = $${idx++}`);                    params.push(doctor_id); }

    const where = wheres.join(' AND ');

    const countQuery = `SELECT COUNT(*) as total FROM appointments a WHERE ${where}`;
    const mainQuery  = `
      SELECT a.*,
             p.name  as patient_name, p.phone as patient_phone, p.email as patient_email,
             s.service_name, s.duration_minutes as service_duration, s.color_code,
             d.name  as doctor_name, d.specialization as doctor_specialization, d.color_tag as doctor_color
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN services s ON a.service_id = s.service_id
      LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
      WHERE ${where}
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

    const [{ rows: appointments }, { rows: countResult }] = await Promise.all([
      pool.query(mainQuery, params),
      pool.query(countQuery, params)
    ]);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: pageNum, limit: limitNum,
          total: parseInt(countResult[0].total),
          totalPages: Math.ceil(parseInt(countResult[0].total) / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointments.' });
  }
};

// ─── Get single appointment ──────────────────────────────────────────────────
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    const { rows: appointments } = await pool.query(
      `SELECT a.*,
              p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
              p.date_of_birth, p.gender, p.address, p.medical_history, p.allergies,
              s.service_name, s.description as service_description,
              s.duration_minutes as service_duration, s.price as service_price, s.color_code,
              d.name as doctor_name, d.specialization as doctor_specialization, d.color_tag as doctor_color
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
       WHERE a.appointment_id = $1 AND a.clinic_id = $2`,
      [id, clinic_id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const { rows: history } = await pool.query(
      'SELECT * FROM appointment_history WHERE appointment_id = $1 ORDER BY performed_at DESC',
      [id]
    );

    res.json({ success: true, data: { appointment: appointments[0], history } });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch appointment.' });
  }
};

// ─── Create appointment ──────────────────────────────────────────────────────
const createAppointment = async (req, res) => {
  try {
    const { patient_id, service_id, doctor_id, appointment_date, appointment_time, notes } = req.body;
    const clinic_id = req.clinic.clinic_id;

    const { rows: services } = await pool.query(
      'SELECT duration_minutes, price FROM services WHERE service_id = $1 AND clinic_id = $2 AND is_active = true',
      [service_id, clinic_id]
    );
    if (services.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found or inactive.' });
    }

    const { duration_minutes, price } = services[0];

    // check slot availability (considering the doctor)
    const isAvailable = await checkTimeSlotAvailability(
      clinic_id, appointment_date, appointment_time, duration_minutes, null, doctor_id || null
    );
    if (!isAvailable) {
      return res.status(409).json({ success: false, message: 'This time slot is not available. Please select a different time.' });
    }

    const { rows: result } = await pool.query(
      `INSERT INTO appointments
         (clinic_id, patient_id, service_id, doctor_id, appointment_date, appointment_time,
          duration_minutes, price, status, notes, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled',$9,'dashboard')
       RETURNING appointment_id`,
      [clinic_id, patient_id, service_id, doctor_id || null, appointment_date, appointment_time, duration_minutes, price, notes || null]
    );

    const appointment_id = result[0].appointment_id;

    await pool.query(
      `INSERT INTO appointment_history (appointment_id, action, new_value, performed_by, notes)
       VALUES ($1,'created',$2,$3,'Appointment created via dashboard')`,
      [appointment_id, JSON.stringify({ status: 'scheduled', date: appointment_date, time: appointment_time }), clinic_id]
    );

    await pool.query(
      'UPDATE patients SET last_visit = $1, total_visits = total_visits + 1 WHERE patient_id = $2 AND clinic_id = $3',
      [appointment_date, patient_id, clinic_id]
    );

    const { rows: appointments } = await pool.query(
      `SELECT a.*, p.name as patient_name, s.service_name, d.name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
       WHERE a.appointment_id = $1`,
      [appointment_id]
    );

    // Queue reminder notifications
    await queueAppointmentReminders({ clinic_id, patient_id, appointment_id, appointment_date, appointment_time });

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: { appointment: appointments[0] }
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to create appointment.' });
  }
};

// ─── Update appointment ──────────────────────────────────────────────────────
const updateAppointment = async (req, res) => {
  try {
    const id = toSafeInt(req.params.id, null);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid appointment ID' });

    const { appointment_date, appointment_time, status, notes, service_id, doctor_id } = req.body;
    const clinic_id = req.clinic.clinic_id;

    const { rows: currentRows } = await pool.query(
      'SELECT * FROM appointments WHERE appointment_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );
    if (currentRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }
    const cur = currentRows[0];

    // Format DB date to YYYY-MM-DD for reliable comparison
    const curDateStr = cur.appointment_date instanceof Date 
      ? cur.appointment_date.toISOString().split('T')[0] 
      : String(cur.appointment_date).split('T')[0];

    // If date/time changed, re-check availability
    const newDate = appointment_date || curDateStr;
    const newTime = appointment_time || cur.appointment_time;
    const newDoctorId = doctor_id !== undefined ? (doctor_id || null) : cur.doctor_id;

    if ((appointment_date && appointment_date !== curDateStr) ||
        (appointment_time && appointment_time !== String(cur.appointment_time)) ||
        (doctor_id !== undefined && doctor_id !== cur.doctor_id)) {
      const isAvailable = await checkTimeSlotAvailability(
        clinic_id, newDate, newTime, cur.duration_minutes, id, newDoctorId
      );
      if (!isAvailable) {
        return res.status(409).json({ success: false, message: 'This time slot is not available.' });
      }
    }

    const fields = [];
    const vals   = [];
    const history = [];
    let n = 1;

    const set = (col, val, histAction, oldVal) => {
      fields.push(`${col} = $${n++}`);
      vals.push(val);
      if (histAction) history.push({ action: histAction, old: String(oldVal), new: String(val) });
    };

    if (appointment_date !== undefined) set('appointment_date', appointment_date, 'date_changed',   cur.appointment_date);
    if (appointment_time !== undefined) set('appointment_time', appointment_time, 'time_changed',   cur.appointment_time);
    if (status          !== undefined) set('status',           status,           'status_changed', cur.status);
    if (notes           !== undefined) set('notes',            notes,            null,             null);
    if (doctor_id       !== undefined) set('doctor_id',        doctor_id || null,'doctor_changed', cur.doctor_id);

    if (service_id !== undefined) {
      const { rows: svc } = await pool.query(
        'SELECT duration_minutes, price FROM services WHERE service_id = $1 AND clinic_id = $2',
        [service_id, clinic_id]
      );
      if (svc.length > 0) {
        set('service_id',       service_id,              'service_changed',  cur.service_id);
        set('duration_minutes', svc[0].duration_minutes, null, null);
        set('price',            svc[0].price,            null, null);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    set('updated_at', new Date(), null, null);
    vals.push(id, clinic_id);

    const updateQuery = `UPDATE appointments SET ${fields.join(', ')} WHERE appointment_id = $${n++} AND clinic_id = $${n++} RETURNING *`;
    const { rows: updatedRows, rowCount } = await pool.query(updateQuery, vals);

    if (rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found or not updated.' });
    }

    const updatedAppt = updatedRows[0];

    // Insert history
    for (const log of history) {
      try {
        await pool.query(
          `INSERT INTO appointment_history (appointment_id, action, old_value, new_value, performed_by, notes)
           VALUES ($1,$2,$3,$4,$5,'Updated via dashboard')`,
          [id, log.action, log.old, log.new, clinic_id]
        );
      } catch (err) {
        console.error('History log error:', err);
      }
    }

    // Return the full appointment data consistent with getById
    const { rows: fullData } = await pool.query(
      `SELECT a.*,
              p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
              p.date_of_birth, p.gender, p.address, p.medical_history, p.allergies,
              s.service_name, s.description as service_description,
              s.duration_minutes as service_duration, s.price as service_price, s.color_code,
              d.name as doctor_name, d.specialization as doctor_specialization, d.color_tag as doctor_color
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
       WHERE a.appointment_id = $1`,
      [id]
    );

    res.json({ 
      success: true, 
      message: 'Appointment updated successfully', 
      data: { appointment: fullData[0] } 
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update appointment.' });
  }
};

// ─── Delete / Cancel appointment ─────────────────────────────────────────────
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    const result = await pool.query(
      "UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE appointment_id = $1 AND clinic_id = $2",
      [id, clinic_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    await pool.query(
      "INSERT INTO appointment_history (appointment_id, action, new_value, performed_by, notes) VALUES ($1,'cancelled','cancelled',$2,'Appointment cancelled')",
      [id, clinic_id]
    );

    res.json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel appointment.' });
  }
};

// ─── Available time slots (clinic-level, optional doctor) ───────────────────
const getAvailableSlots = async (req, res) => {
  try {
    const { date, service_id, doctor_id } = req.query;
    const clinic_id = req.clinic.clinic_id;

    if (!date || !service_id) {
      return res.status(400).json({ success: false, message: 'date and service_id are required.' });
    }

    // If doctor specified, delegate to doctor slot logic
    if (doctor_id) {
      const { rows: avRows } = await pool.query(
        `SELECT da.*, d.is_active
         FROM doctors d
         LEFT JOIN doctor_availability da ON da.doctor_id = d.doctor_id
         WHERE d.doctor_id = $1 AND d.clinic_id = $2`,
        [doctor_id, clinic_id]
      );

      if (avRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Doctor not found.' });
      }

      const avail = avRows[0];

      if (!avail.is_active) {
        return res.json({ success: true, data: { slots: [], message: 'Doctor is not active.' } });
      }

      // Check leave
      const { rows: leaves } = await pool.query(
        'SELECT id FROM doctor_leaves WHERE doctor_id = $1 AND leave_date = $2',
        [doctor_id, date]
      );
      if (leaves.length > 0) {
        return res.json({ success: true, data: { slots: [], message: 'Doctor is on leave on this day.' } });
      }

      // Check working day for doctor
      const workingDays = parseWorkingDays(avail.working_days);
      const [yr, mo, dy] = date.split('-').map(Number);
      const dow = new Date(yr, mo - 1, dy).getDay();

      if (!workingDays.includes(dow)) {
        return res.json({ success: true, data: { slots: [], message: 'Doctor is not available on this day.' } });
      }

      const { rows: svc } = await pool.query(
        'SELECT duration_minutes FROM services WHERE service_id = $1 AND clinic_id = $2 AND is_active = true',
        [service_id, clinic_id]
      );
      if (svc.length === 0) {
        return res.status(404).json({ success: false, message: 'Service not found.' });
      }

      const { rows: booked } = await pool.query(
        `SELECT appointment_time, duration_minutes FROM appointments
         WHERE doctor_id = $1 AND appointment_date = $2 AND status IN ('scheduled','confirmed')`,
        [doctor_id, date]
      );

      const slots = generateTimeSlots(
        avail.start_time, avail.end_time,
        svc[0].duration_minutes, booked, date, 'Asia/Kolkata',
        avail.break_start, avail.break_end, avail.slot_interval || 30
      );

      return res.json({ success: true, data: { date, service_duration: svc[0].duration_minutes, slots } });
    }

    // Clinic-level slots (no specific doctor)
    const { rows: clinicRows } = await pool.query(
      'SELECT working_hours_start, working_hours_end, working_days, slot_interval_minutes, timezone FROM clinics WHERE clinic_id = $1',
      [clinic_id]
    );
    if (clinicRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Clinic not found.' });
    }

    const clinic = clinicRows[0];
    const workingDays = parseWorkingDays(clinic.working_days);
    const [year, month, day] = date.split('-').map(Number);
    const selectedDay = new Date(year, month - 1, day).getDay();

    if (!workingDays.includes(selectedDay)) {
      return res.json({ success: true, data: { date, slots: [], message: 'Clinic is closed on this day.' } });
    }

    const { rows: svc } = await pool.query(
      'SELECT duration_minutes FROM services WHERE service_id = $1 AND clinic_id = $2 AND is_active = true',
      [service_id, clinic_id]
    );
    if (svc.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    const { rows: booked } = await pool.query(
      `SELECT appointment_time, duration_minutes FROM appointments
       WHERE clinic_id = $1 AND appointment_date = $2 AND status IN ('scheduled','confirmed')
       ORDER BY appointment_time`,
      [clinic_id, date]
    );

    const slots = generateTimeSlots(
      clinic.working_hours_start, clinic.working_hours_end,
      svc[0].duration_minutes, booked, date,
      clinic.timezone || 'Asia/Kolkata',
      null, null, clinic.slot_interval_minutes || 30
    );

    res.json({
      success: true,
      data: {
        date,
        service_duration: svc[0].duration_minutes,
        working_hours: { start: clinic.working_hours_start, end: clinic.working_hours_end },
        slots
      }
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch available slots.' });
  }
};

// ─── Today's appointments ────────────────────────────────────────────────────
const getTodayAppointments = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const { rows: appointments } = await pool.query(
      `SELECT a.*,
              p.name as patient_name, p.phone as patient_phone,
              s.service_name, s.color_code,
              d.name as doctor_name, d.color_tag as doctor_color
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
       WHERE a.clinic_id = $1 AND a.appointment_date = CURRENT_DATE
       ORDER BY a.appointment_time`,
      [clinic_id]
    );
    res.json({ success: true, data: { appointments } });
  } catch (error) {
    console.error('Get today appointments error:', error);
    res.status(500).json({ success: false, message: "Failed to fetch today's appointments." });
  }
};

// ─── Upcoming appointments ───────────────────────────────────────────────────
const getUpcomingAppointments = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const clinic_id = req.clinic.clinic_id;
    const limitNum = clamp(toSafeInt(limit, 10), 1, 200);

    const { rows: appointments } = await pool.query(
      `SELECT a.*,
              p.name as patient_name, p.phone as patient_phone,
              s.service_name, s.color_code,
              d.name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
       WHERE a.clinic_id = $1
         AND a.appointment_date >= CURRENT_DATE
         AND a.status IN ('scheduled','confirmed')
       ORDER BY a.appointment_date, a.appointment_time
       LIMIT ${limitNum}`,
      [clinic_id]
    );
    res.json({ success: true, data: { appointments } });
  } catch (error) {
    console.error('Get upcoming appointments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch upcoming appointments.' });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseWorkingDays = (val) => {
  const fallback = [1,2,3,4,5,6];
  if (!val) return fallback;
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
  } catch (_) {}
  return fallback;
};

const checkTimeSlotAvailability = async (clinic_id, date, time, duration, excludeId = null, doctor_id = null) => {
  let q = `SELECT appointment_time, duration_minutes FROM appointments
           WHERE clinic_id = $1 AND appointment_date = $2 AND status IN ('scheduled','confirmed')`;
  let p = [clinic_id, date];
  let idx = 3;

  if (doctor_id) { q += ` AND doctor_id = $${idx++}`; p.push(doctor_id); }
  if (excludeId) { q += ` AND appointment_id != $${idx++}`; p.push(excludeId); }

  const { rows } = await pool.query(q, p);
  const reqStart = timeToMinutes(time);
  const reqEnd   = reqStart + duration;

  for (const a of rows) {
    const as = timeToMinutes(a.appointment_time);
    const ae = as + a.duration_minutes;
    if (reqStart < ae && reqEnd > as) return false;
  }
  return true;
};

const generateTimeSlots = (workingStart, workingEnd, serviceDuration, existing, date, timezone = 'Asia/Kolkata', breakStart = null, breakEnd = null, interval = 30) => {
  const slots     = [];
  const startMin  = timeToMinutes(workingStart);
  const endMin    = timeToMinutes(workingEnd);
  const brkStart  = breakStart ? timeToMinutes(breakStart) : null;
  const brkEnd    = breakEnd   ? timeToMinutes(breakEnd)   : null;

  const now = new Date();
  let localDate, nowMinutes;
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', hour12: false
    });
    const parts = fmt.formatToParts(now);
    const get = (t) => parts.find(p => p.type === t).value;
    localDate   = `${get('year')}-${get('month')}-${get('day')}`;
    nowMinutes  = parseInt(get('hour')) * 60 + parseInt(get('minute'));
  } catch (_) {
    localDate  = now.toISOString().split('T')[0];
    nowMinutes = now.getHours() * 60 + now.getMinutes();
  }
  const isToday = date === localDate;

  for (let t = startMin; t + serviceDuration <= endMin; t += interval) {
    // skip break window
    if (brkStart !== null && brkEnd !== null && t < brkEnd && t + serviceDuration > brkStart) continue;
    // skip past slots on today
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

const timeToMinutes = (t) => {
  if (!t) return 0;
  const str = typeof t === 'string' ? t : String(t);
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (m) => {
  const h  = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
};

module.exports = {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAvailableSlots,
  getTodayAppointments,
  getUpcomingAppointments
};