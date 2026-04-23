import { query, withTransaction } from '../config/db.js';
import { sendWhatsAppMessage } from '../services/whatsappService.js';
import logger from '../utils/logger.js';

// ─── Helpers ───────────────────
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
  const allDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  if (!val) return allDays;
  try { 
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (!Array.isArray(parsed)) return allDays;
    
    return parsed.map(d => {
      // Handle numeric indices (as number 1 or string "1")
      const idx = parseInt(d, 10);
      if (!isNaN(idx) && idx >= 0 && idx <= 6) {
        return allDays[idx];
      }
      // Handle day name strings (e.g., "Monday" -> "mon")
      return String(d).toLowerCase().slice(0, 3);
    });
  } catch (_) { 
    // Fallback for non-JSON string formats
    if (typeof val === 'string') {
      return val.split(',').map(d => {
        const idx = parseInt(d.trim(), 10);
        if (!isNaN(idx) && idx >= 0 && idx <= 6) return allDays[idx];
        return d.trim().toLowerCase().slice(0, 3);
      });
    }
    return allDays; 
  }
};

const isValidUUID = (id) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(id);
};


export const getAppointments = async (req, res, next) => {
  try {
    const { date, dentistId, status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT a.*, p.name as patient_name, u.name as dentist_name,
             s.name as service_name, s.price as service_price
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN doctors u ON a.dentist_id = u.id
      LEFT JOIN services s ON a.service_id = s.id
      WHERE a.clinic_id = $1
    `;
    const params = [req.clinicId];

    if (date) {
      sql += ` AND a.scheduled_at::date = $${params.length + 1}::date`;
      params.push(date);
    }
    if (dentistId) {
      sql += ` AND a.dentist_id = $${params.length + 1}`;
      params.push(dentistId);
    }
    if (status) {
      sql += ` AND a.status = $${params.length + 1}`;
      params.push(status);
    }

    sql += ` ORDER BY a.scheduled_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);
    res.json({ success: true, data: { appointments: result.rows } });
  } catch (error) {
    next(error);
  }
};

export const getTodayAppointments = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT a.*, p.name as patient_name, u.name as dentist_name,
              s.name as service_name, s.price as service_price
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       LEFT JOIN doctors u ON a.dentist_id = u.id
       LEFT JOIN services s ON a.service_id = s.id
       WHERE a.clinic_id = $1
         AND a.scheduled_at::date = CURRENT_DATE
         AND a.status != 'cancelled'
       ORDER BY a.scheduled_at ASC`,
      [req.clinicId]
    );
    res.json({ success: true, data: { appointments: result.rows } });
  } catch (error) {
    next(error);
  }
};

export const getAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.*, p.name as patient_name, p.phone as patient_phone,
              u.name as dentist_name, s.name as service_name, s.price as service_price
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       LEFT JOIN doctors u ON a.dentist_id = u.id
       LEFT JOIN services s ON a.service_id = s.id
       WHERE a.id = $1 AND a.clinic_id = $2`,
      [id, req.clinicId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, data: { appointment: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req, res, next) => {
  try {
    const { 
      patient_id, patientId, 
      service_id, serviceId,
      doctor_id, dentistId, 
      appointment_date, scheduledAt,
      appointment_time,
      duration_mins, durationMins, 
      type, notes, amount 
    } = req.body;


    const pId = patient_id || patientId;
    const dId = doctor_id || dentistId;
    const sId = service_id || serviceId;
    const sAt = appointment_date && appointment_time ? `${appointment_date} ${appointment_time}` : (scheduledAt);
    let dMins = duration_mins || durationMins;

    // ISSUE 1: Fetch service details to ensure correct persistence
    let appointmentType = type || "Consultation";
    let appointmentAmount = amount || 0;
    
    if (sId && isValidUUID(sId)) {
      const serviceRes = await query(
        "SELECT name, price, duration_mins FROM services WHERE id = $1 AND clinic_id = $2 LIMIT 1",
        [sId, req.clinicId]
      );
      if (serviceRes.rows.length > 0) {
        const sRow = serviceRes.rows[0];
        appointmentType = sRow.name;
        appointmentAmount = sRow.price;
        if (!dMins) dMins = sRow.duration_mins;
      }
    }


    // Verify patient belongs to this clinic
    const patientCheck = await query(
      'SELECT id FROM patients WHERE id = $1 AND clinic_id = $2',
      [pId, req.clinicId]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Patient not found in this clinic' });
    }

    // Verify dentist belongs to this clinic
    if (dId && dId !== 'any') {
      const dentistCheck = await query(
        "SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2",
        [dId, req.clinicId]
      );
      if (dentistCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Doctor not found or invalid' });
      }
    }


    const appointment = await withTransaction(async (client) => {
      // Prevent double-booking with SELECT FOR UPDATE
      if (dId && dId !== 'any' && sAt) {
        const slotCheck = await client.query(
          `SELECT id FROM appointments
           WHERE dentist_id = $1 AND scheduled_at = $2
           AND status NOT IN ('cancelled', 'no_show')
           FOR UPDATE`,
          [dId, sAt]
        );

        if (slotCheck.rows.length > 0) {
          const err = new Error('This time slot is already booked');
          err.status = 409;
          throw err;
        }
      }

      const insertRes = await client.query(
        `INSERT INTO appointments
         (clinic_id, patient_id, dentist_id, scheduled_at, duration_mins, status, type, notes, amount, created_by, service_id)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, $10) RETURNING *`,
        [req.clinicId, pId, (dId === 'any' ? null : dId), sAt, dMins || 30, appointmentType, notes || null, appointmentAmount, req.user.id, sId]
      );

      return insertRes.rows[0];
    });

    // ─── Fire-and-forget WhatsApp confirmation ───────────────
    // Non-blocking: never delays the API response
    (async () => {
      try {
        const patientRes = await query(
          'SELECT phone FROM patients WHERE id = $1 AND clinic_id = $2',
          [appointment.patient_id, req.clinicId]
        );
        const phone = patientRes.rows[0]?.phone;
        if (phone) {
          const dateStr = appointment.scheduled_at
            ? new Date(appointment.scheduled_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
            : 'TBD';
          const timeStr = appointment.scheduled_at
            ? new Date(appointment.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
            : 'TBD';

          const message = `🦷 Appointment Confirmed\nDate: ${dateStr}\nTime: ${timeStr}\nClinic: DentFlow`;
          sendWhatsAppMessage(phone, message);
        }
      } catch (err) {
        logger.error('WhatsApp notification failed (non-blocking)', { error: err.message });
      }
    })();

    res.status(201).json({ success: true, data: { appointment } });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, treatmentDone, amount } = req.body;

    const result = await query(
      `UPDATE appointments
       SET status         = COALESCE($1, status),
           notes          = COALESCE($2, notes),
           treatment_done = COALESCE($3, treatment_done),
           amount         = COALESCE($4, amount),
           updated_at     = NOW()
       WHERE id = $5 AND clinic_id = $6
       RETURNING *`,
      [status, notes, treatmentDone, amount, id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, data: { appointment: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Validate status value
    const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await query(
      `UPDATE appointments 
       SET status = COALESCE($1, status), notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 AND clinic_id = $4
       RETURNING *`,
      [status || null, notes || null, id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, data: { appointment: result.rows[0] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update appointment status' });
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE appointments SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND clinic_id = $2 RETURNING *`,
      [id, req.clinicId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    res.json({ success: true, data: { appointment: result.rows[0] } });
  } catch (error) {
    next(error);
  }
};

export const getAvailableSlots = async (req, res, next) => {
  try {
    const { date, service_id, doctor_id } = req.query;
    const clinicId = req.clinicId;

    if (!date || !service_id) {
      return res.status(400).json({ success: false, message: 'date and service_id are required.' });
    }

    if (!isValidUUID(service_id)) {
      return res.status(400).json({ success: false, message: 'Invalid service_id format. Expected UUID.' });
    }

    if (doctor_id && doctor_id !== 'any' && !isValidUUID(doctor_id)) {
      return res.status(400).json({ success: false, message: 'Invalid doctor_id format. Expected UUID.' });
    }


    let start_time, end_time, working_days, break_start, break_end, slot_interval;
    let timezone = 'Asia/Kolkata';

    if (doctor_id && doctor_id !== 'any') {
      const doctorRes = await query(
        `SELECT working_days, start_time, end_time, break_start, break_end, slot_interval, is_active
         FROM doctors WHERE id = $1 AND clinic_id = $2`,
        [doctor_id, clinicId]
      );

      if (doctorRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Doctor not found.' });
      const doctor = doctorRes.rows[0];
      if (!doctor.is_active) return res.json({ success: true, data: { slots: [] } });

      working_days = doctor.working_days;
      start_time = doctor.start_time || '09:00:00';
      end_time = doctor.end_time || '18:00:00';
      break_start = doctor.break_start;
      break_end = doctor.break_end;
      slot_interval = doctor.slot_interval;
    } else {
      const clinicRes = await query(
        'SELECT working_hours_start, working_hours_end, working_days, slot_interval_minutes, timezone FROM clinics WHERE id = $1',
        [clinicId]
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
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    
    // TIMEZONE SAFE DAY-OF-WEEK:
    // Parsing "YYYY-MM-DD" as local time by splitting avoids "getUTCDay vs getDay" shifted mismatch.
    const [y, m, d] = date.split('-').map(Number);
    const selectedDate = new Date(y, m - 1, d);
    const selectedDay = dayNames[selectedDate.getDay()];

    if (!wDays.includes(selectedDay)) return res.json({ success: true, data: { slots: [], message: 'Clinic or doctor is closed on this day.' } });



    const serviceRes = await query(
      'SELECT duration_mins FROM services WHERE id = $1 AND clinic_id = $2 AND is_active = true',
      [service_id, clinicId]
    );
    if (serviceRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Service not found.' });
    const duration = serviceRes.rows[0].duration_mins;

    let bookedSql = `
      SELECT scheduled_at::time as appointment_time, duration_mins
      FROM appointments
      WHERE clinic_id = $1 AND scheduled_at::date = $2 AND status IN ('scheduled','confirmed')
    `;
    const bookedParams = [clinicId, date];
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

