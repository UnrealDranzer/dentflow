const { pool } = require('../config/database');

// ─── Helpers ────────────────────────────────────────────────────────────────

const parseWorkingDays = (val) => {
  const fallback = [1, 2, 3, 4, 5, 6];
  if (val == null) return fallback;
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (Array.isArray(parsed)) {
      const days = parsed.map(Number).filter(Number.isFinite);
      return days.length ? days : fallback;
    }
  } catch (_) {}
  return fallback;
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

// ─── CRUD ───────────────────────────────────────────────────────────────────

// GET /api/doctors
const getAllDoctors = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const { search, active_only = 'false' } = req.query;

    let query = `
      SELECT d.*,
             da.working_days, da.start_time, da.end_time,
             da.break_start, da.break_end, da.slot_interval
      FROM doctors d
      LEFT JOIN doctor_availability da ON da.doctor_id = d.doctor_id
      WHERE d.clinic_id = $1
    `;
    const params = [clinic_id];
    let idx = 2;

    if (active_only === 'true') {
      query += ` AND d.is_active = true`;
    }
    if (search) {
      query += ` AND (d.name ILIKE $${idx} OR d.specialization ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY d.name';

    const { rows: doctors } = await pool.query(query, params);

    res.json({ success: true, data: { doctors } });
  } catch (err) {
    console.error('getAllDoctors error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch doctors.' });
  }
};

// GET /api/doctors/:id
const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    const { rows: doctors } = await pool.query(
      `SELECT d.*,
              da.working_days, da.start_time, da.end_time,
              da.break_start, da.break_end, da.slot_interval
       FROM doctors d
       LEFT JOIN doctor_availability da ON da.doctor_id = d.doctor_id
       WHERE d.doctor_id = $1 AND d.clinic_id = $2`,
      [id, clinic_id]
    );

    if (doctors.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    // upcoming leaves
    const { rows: leaves } = await pool.query(
      `SELECT * FROM doctor_leaves
       WHERE doctor_id = $1 AND leave_date >= CURRENT_DATE
       ORDER BY leave_date`,
      [id]
    );

    // recent appointments
    const { rows: appointments } = await pool.query(
      `SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
              p.name as patient_name, s.service_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.doctor_id = $1 AND a.clinic_id = $2
       ORDER BY a.appointment_date DESC
       LIMIT 10`,
      [id, clinic_id]
    );

    res.json({
      success: true,
      data: { doctor: doctors[0], leaves, recent_appointments: appointments }
    });
  } catch (err) {
    console.error('getDoctorById error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch doctor.' });
  }
};

// POST /api/doctors
const createDoctor = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;
    const {
      name, specialization, phone, email, qualification,
      experience_years, color_tag, photo_url,
      // availability
      working_days, start_time, end_time, break_start, break_end, slot_interval
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Doctor name is required.' });
    }

    // check email uniqueness in clinic
    if (email) {
      const { rows: existing } = await pool.query(
        'SELECT doctor_id FROM doctors WHERE clinic_id = $1 AND email = $2',
        [clinic_id, email]
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'A doctor with this email already exists.' });
      }
    }

    const { rows: result } = await pool.query(
      `INSERT INTO doctors (clinic_id, name, specialization, phone, email, qualification,
         experience_years, color_tag, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING doctor_id`,
      [clinic_id, name, specialization || null, phone || null, email || null,
       qualification || null, experience_years || null, color_tag || '#3B82F6', photo_url || null]
    );

    const doctor_id = result[0].doctor_id;

    // create default availability
    await pool.query(
      `INSERT INTO doctor_availability
         (doctor_id, clinic_id, working_days, start_time, end_time, break_start, break_end, slot_interval)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (doctor_id) DO NOTHING`,
      [
        doctor_id, clinic_id,
        JSON.stringify(working_days || [1,2,3,4,5,6]),
        start_time || '09:00:00',
        end_time   || '18:00:00',
        break_start || null,
        break_end   || null,
        slot_interval || 30
      ]
    );

    const { rows: doctors } = await pool.query(
      `SELECT d.*, da.working_days, da.start_time, da.end_time, da.break_start, da.break_end, da.slot_interval
       FROM doctors d
       LEFT JOIN doctor_availability da ON da.doctor_id = d.doctor_id
       WHERE d.doctor_id = $1`,
      [doctor_id]
    );

    res.status(201).json({
      success: true,
      message: 'Doctor added successfully',
      data: { doctor: doctors[0] }
    });
  } catch (err) {
    console.error('createDoctor error:', err);
    res.status(500).json({ success: false, message: 'Failed to create doctor.' });
  }
};

// PUT /api/doctors/:id
const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;
    const {
      name, specialization, phone, email, qualification,
      experience_years, color_tag, photo_url, is_active,
      working_days, start_time, end_time, break_start, break_end, slot_interval
    } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT doctor_id FROM doctors WHERE doctor_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    // Build dynamic update query
    const fields = [];
    const vals  = [];
    let n = 1;

    const set = (col, val) => { fields.push(`${col} = $${n++}`); vals.push(val); };

    if (name           !== undefined) set('name',            name);
    if (specialization !== undefined) set('specialization',  specialization);
    if (phone          !== undefined) set('phone',           phone);
    if (email          !== undefined) set('email',           email);
    if (qualification  !== undefined) set('qualification',   qualification);
    if (experience_years !== undefined) set('experience_years', experience_years);
    if (color_tag      !== undefined) set('color_tag',       color_tag);
    if (photo_url      !== undefined) set('photo_url',       photo_url);
    if (is_active      !== undefined) set('is_active',       is_active);

    if (fields.length > 0) {
      set('updated_at', new Date());
      await pool.query(
        `UPDATE doctors SET ${fields.join(', ')} WHERE doctor_id = $${n++} AND clinic_id = $${n++}`,
        [...vals, id, clinic_id]
      );
    }

    // Update availability if provided
    if (working_days !== undefined || start_time || end_time) {
      await pool.query(
        `INSERT INTO doctor_availability
           (doctor_id, clinic_id, working_days, start_time, end_time, break_start, break_end, slot_interval)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (doctor_id) DO UPDATE SET
           working_days = EXCLUDED.working_days,
           start_time   = EXCLUDED.start_time,
           end_time     = EXCLUDED.end_time,
           break_start  = EXCLUDED.break_start,
           break_end    = EXCLUDED.break_end,
           slot_interval = EXCLUDED.slot_interval,
           updated_at   = NOW()`,
        [
          id, clinic_id,
          JSON.stringify(working_days || [1,2,3,4,5,6]),
          start_time  || '09:00:00',
          end_time    || '18:00:00',
          break_start || null,
          break_end   || null,
          slot_interval || 30
        ]
      );
    }

    const { rows: doctors } = await pool.query(
      `SELECT d.*, da.working_days, da.start_time, da.end_time, da.break_start, da.break_end, da.slot_interval
       FROM doctors d
       LEFT JOIN doctor_availability da ON da.doctor_id = d.doctor_id
       WHERE d.doctor_id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Doctor updated successfully', data: { doctor: doctors[0] } });
  } catch (err) {
    console.error('updateDoctor error:', err);
    res.status(500).json({ success: false, message: 'Failed to update doctor.' });
  }
};

// DELETE /api/doctors/:id  (soft delete)
const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    // check future appointments
    const { rows: appts } = await pool.query(
      `SELECT appointment_id FROM appointments
       WHERE doctor_id = $1 AND clinic_id = $2
         AND appointment_date >= CURRENT_DATE
         AND status IN ('scheduled','confirmed')`,
      [id, clinic_id]
    );
    if (appts.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete doctor with ${appts.length} upcoming appointment(s). Please reassign or cancel them first.`
      });
    }

    const result = await pool.query(
      'UPDATE doctors SET is_active = false WHERE doctor_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    res.json({ success: true, message: 'Doctor deactivated successfully.' });
  } catch (err) {
    console.error('deleteDoctor error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete doctor.' });
  }
};

// ─── Availability & Leaves ───────────────────────────────────────────────────

// PUT /api/doctors/:id/availability
const updateAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;
    const { working_days, start_time, end_time, break_start, break_end, slot_interval } = req.body;

    const { rows: doc } = await pool.query(
      'SELECT doctor_id FROM doctors WHERE doctor_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );
    if (doc.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    await pool.query(
      `INSERT INTO doctor_availability
         (doctor_id, clinic_id, working_days, start_time, end_time, break_start, break_end, slot_interval)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (doctor_id) DO UPDATE SET
         working_days  = EXCLUDED.working_days,
         start_time    = EXCLUDED.start_time,
         end_time      = EXCLUDED.end_time,
         break_start   = EXCLUDED.break_start,
         break_end     = EXCLUDED.break_end,
         slot_interval = EXCLUDED.slot_interval,
         updated_at    = NOW()`,
      [
        id, clinic_id,
        JSON.stringify(working_days || [1,2,3,4,5,6]),
        start_time  || '09:00:00',
        end_time    || '18:00:00',
        break_start || null,
        break_end   || null,
        slot_interval || 30
      ]
    );

    res.json({ success: true, message: 'Availability updated.' });
  } catch (err) {
    console.error('updateAvailability error:', err);
    res.status(500).json({ success: false, message: 'Failed to update availability.' });
  }
};

// POST /api/doctors/:id/leaves
const addLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;
    const { leave_date, reason } = req.body;

    if (!leave_date) {
      return res.status(400).json({ success: false, message: 'leave_date is required.' });
    }

    const { rows: doc } = await pool.query(
      'SELECT doctor_id FROM doctors WHERE doctor_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );
    if (doc.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    await pool.query(
      `INSERT INTO doctor_leaves (doctor_id, clinic_id, leave_date, reason)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [id, clinic_id, leave_date, reason || null]
    );

    res.status(201).json({ success: true, message: 'Leave added.' });
  } catch (err) {
    console.error('addLeave error:', err);
    res.status(500).json({ success: false, message: 'Failed to add leave.' });
  }
};

// DELETE /api/doctors/:id/leaves/:leaveId
const removeLeave = async (req, res) => {
  try {
    const { id, leaveId } = req.params;
    const clinic_id = req.clinic.clinic_id;

    const result = await pool.query(
      'DELETE FROM doctor_leaves WHERE id = $1 AND doctor_id = $2 AND clinic_id = $3',
      [leaveId, id, clinic_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Leave not found.' });
    }

    res.json({ success: true, message: 'Leave removed.' });
  } catch (err) {
    console.error('removeLeave error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove leave.' });
  }
};

// ─── Available Slots by Doctor ───────────────────────────────────────────────

// GET /api/doctors/:id/available-slots?date=YYYY-MM-DD&service_id=n
const getDoctorAvailableSlots = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, service_id } = req.query;
    const clinic_id = req.clinic.clinic_id;

    if (!date || !service_id) {
      return res.status(400).json({ success: false, message: 'date and service_id are required.' });
    }

    // get doctor availability
    const { rows: avRows } = await pool.query(
      `SELECT da.*, d.is_active
       FROM doctors d
       LEFT JOIN doctor_availability da ON da.doctor_id = d.doctor_id
       WHERE d.doctor_id = $1 AND d.clinic_id = $2`,
      [id, clinic_id]
    );

    if (avRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const avail = avRows[0];
    if (!avail.is_active) {
      return res.json({ success: true, data: { slots: [], message: 'Doctor is not active.' } });
    }

    // check leave
    const { rows: leaves } = await pool.query(
      'SELECT id FROM doctor_leaves WHERE doctor_id = $1 AND leave_date = $2',
      [id, date]
    );
    if (leaves.length > 0) {
      return res.json({ success: true, data: { slots: [], message: 'Doctor is on leave on this day.' } });
    }

    // check working day
    const workingDays = parseWorkingDays(avail.working_days || '[1,2,3,4,5,6]');
    const [year, month, day] = date.split('-').map(Number);
    const dow = new Date(year, month - 1, day).getDay();

    if (!workingDays.includes(dow)) {
      return res.json({ success: true, data: { slots: [], message: 'Doctor is not available on this day.' } });
    }

    // get service duration
    const { rows: svc } = await pool.query(
      'SELECT duration_minutes FROM services WHERE service_id = $1 AND clinic_id = $2 AND is_active = true',
      [service_id, clinic_id]
    );
    if (svc.length === 0) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }
    const duration = svc[0].duration_minutes;

    // get existing appointments for this doctor on this date
    const { rows: booked } = await pool.query(
      `SELECT appointment_time, duration_minutes
       FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND status IN ('scheduled','confirmed')`,
      [id, date]
    );

    // generate slots
    const startMin  = timeToMinutes(avail.start_time  || '09:00');
    const endMin    = timeToMinutes(avail.end_time    || '18:00');
    const brkStart  = avail.break_start ? timeToMinutes(avail.break_start) : null;
    const brkEnd    = avail.break_end   ? timeToMinutes(avail.break_end)   : null;
    const interval  = avail.slot_interval || 30;

    // current time in Asia/Kolkata
    const now = new Date();
    const localStr = now.toLocaleString('en-CA', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
    const [localDate, localTime] = localStr.split(', ');
    const [lh, lm] = localTime.split(':').map(Number);
    const nowMinutes = lh * 60 + lm;
    const isToday = date === localDate;

    const slots = [];

    for (let t = startMin; t + duration <= endMin; t += interval) {
      // skip break
      if (brkStart !== null && brkEnd !== null && t < brkEnd && t + duration > brkStart) continue;
      // skip past for today
      if (isToday && t <= nowMinutes) continue;

      // check overlap with booked
      let available = true;
      for (const b of booked) {
        const bs = timeToMinutes(b.appointment_time);
        const be = bs + b.duration_minutes;
        if (t < be && t + duration > bs) { available = false; break; }
      }

      slots.push({ time: minutesToTime(t), end_time: minutesToTime(t + duration), available });
    }

    res.json({
      success: true,
      data: {
        date,
        doctor_id: parseInt(id),
        service_duration: duration,
        working_hours: { start: avail.start_time, end: avail.end_time },
        slots
      }
    });
  } catch (err) {
    console.error('getDoctorAvailableSlots error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch available slots.' });
  }
};

module.exports = {
  getAllDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  updateAvailability,
  addLeave,
  removeLeave,
  getDoctorAvailableSlots
};
