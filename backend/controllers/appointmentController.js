const { pool } = require('../config/database');
const { queueAppointmentReminders } = require('../utils/notificationService');

const toSafeInt = (value, fallback) => {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Get all appointments for a clinic
const getAllAppointments = async (req, res) => {
  try {
    const {
      date,
      start_date,
      end_date,
      status,
      patient_id,
      page = 1,
      limit = 50
    } = req.query;
    const clinic_id = req.clinic.clinic_id;
    const pageNum = clamp(toSafeInt(page, 1), 1, 1000000);
    const limitNum = clamp(toSafeInt(limit, 50), 1, 200);
    const offsetNum = (pageNum - 1) * limitNum;

    let query = `
      SELECT a.*, 
             p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
             s.service_name, s.duration_minutes as service_duration, s.color_code
      FROM appointments a
      JOIN patients p ON a.patient_id = p.patient_id
      JOIN services s ON a.service_id = s.service_id
      WHERE a.clinic_id = ?
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM appointments WHERE clinic_id = ?';
    let params = [clinic_id];
    let countParams = [clinic_id];

    if (date) {
      query += ' AND a.appointment_date = ?';
      countQuery += ' AND appointment_date = ?';
      params.push(date);
      countParams.push(date);
    }

    if (start_date && end_date) {
      query += ' AND a.appointment_date BETWEEN ? AND ?';
      countQuery += ' AND appointment_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
      countParams.push(start_date, end_date);
    }

    if (status) {
      query += ' AND a.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (patient_id) {
      query += ' AND a.patient_id = ?';
      countQuery += ' AND patient_id = ?';
      params.push(patient_id);
      countParams.push(patient_id);
    }

    // MySQL prepared statements can reject placeholders for LIMIT/OFFSET.
    query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    // Convert ? to $1, $2, etc. for PostgreSQL
    let paramIndex = 1;
    const postgresQuery = query.replace(/\?/g, () => `$${paramIndex++}`);
    paramIndex = 1; // reset for countQuery
    const postgresCountQuery = countQuery.replace(/\?/g, () => `$${paramIndex++}`);

    const { rows: appointments } = await pool.query(postgresQuery, params);
    const { rows: countResult } = await pool.query(postgresCountQuery, countParams);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult[0].total,
          totalPages: Math.ceil(countResult[0].total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments.'
    });
  }
};

// Get single appointment
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    const { rows: appointments } = await pool.query(
      `SELECT a.*, 
              p.name as patient_name, p.phone as patient_phone, p.email as patient_email,
              p.date_of_birth, p.gender, p.address, p.medical_history, p.allergies,
              s.service_name, s.description as service_description, s.duration_minutes as service_duration, 
              s.price as service_price, s.color_code
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.appointment_id = $1 AND a.clinic_id = $2`,
      [id, clinic_id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    const { rows: history } = await pool.query(
      `SELECT * FROM appointment_history 
       WHERE appointment_id = $1 
       ORDER BY performed_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        appointment: appointments[0],
        history
      }
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment.'
    });
  }
};

// Create new appointment
const createAppointment = async (req, res) => {
  try {
    const { patient_id, service_id, appointment_date, appointment_time, notes } = req.body;
    const clinic_id = req.clinic.clinic_id;

    const { rows: services } = await pool.query(
      'SELECT duration_minutes FROM services WHERE service_id = $1 AND clinic_id = $2 AND is_active = true',
      [service_id, clinic_id]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or inactive.'
      });
    }

    const duration_minutes = services[0].duration_minutes;

    const isAvailable = await checkTimeSlotAvailability(
      clinic_id, 
      appointment_date, 
      appointment_time, 
      duration_minutes
    );

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is not available. Please select a different time.'
      });
    }

    const { rows: result } = await pool.query(
      `INSERT INTO appointments (clinic_id, patient_id, service_id, appointment_date, appointment_time, 
        duration_minutes, status, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, 'dashboard')
       RETURNING appointment_id`,
      [clinic_id, patient_id, service_id, appointment_date, appointment_time, duration_minutes, notes]
    );

    const appointment_id = result[0].appointment_id;

    await pool.query(
      `INSERT INTO appointment_history (appointment_id, action, new_value, performed_by, notes)
       VALUES ($1, 'created', $2, $3, 'Appointment created via dashboard')`,
      [appointment_id, JSON.stringify({ status: 'scheduled', date: appointment_date, time: appointment_time }), clinic_id]
    );

    await pool.query(
      `UPDATE patients 
       SET last_visit = $1, total_visits = total_visits + 1
       WHERE patient_id = $2 AND clinic_id = $3`,
      [appointment_date, patient_id, clinic_id]
    );

    const { rows: appointments } = await pool.query(
      `SELECT a.*, p.name as patient_name, s.service_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.appointment_id = $1`,
      [appointment_id]
    );

    // Queue reminder notifications (SMS / WhatsApp) if enabled
    await queueAppointmentReminders({
      clinic_id,
      patient_id,
      appointment_id,
      appointment_date,
      appointment_time,
    });

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: { appointment: appointments[0] }
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment.'
    });
  }
};

// Update appointment (UNCHANGED)
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { appointment_date, appointment_time, status, notes, service_id } = req.body;
    const clinic_id = req.clinic.clinic_id;

    const { rows: currentAppointments } = await pool.query(
      'SELECT * FROM appointments WHERE appointment_id = $1 AND clinic_id = $2',
      [id, clinic_id]
    );

    if (currentAppointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    const currentAppointment = currentAppointments[0];

    if ((appointment_date && appointment_date !== currentAppointment.appointment_date) ||
        (appointment_time && appointment_time !== currentAppointment.appointment_time)) {
      
      const newDate = appointment_date || currentAppointment.appointment_date;
      const newTime = appointment_time || currentAppointment.appointment_time;
      const duration = currentAppointment.duration_minutes;

      const isAvailable = await checkTimeSlotAvailability(
        clinic_id, 
        newDate, 
        newTime, 
        duration,
        id
      );

      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          message: 'This time slot is not available. Please select a different time.'
        });
      }
    }

    const updates = [];
    const values = [];
    const historyLogs = [];

    if (appointment_date) {
      updates.push('appointment_date = ?');
      values.push(appointment_date);
      historyLogs.push({
        action: 'date_changed',
        old: currentAppointment.appointment_date,
        new: appointment_date
      });
    }

    if (appointment_time) {
      updates.push('appointment_time = ?');
      values.push(appointment_time);
      historyLogs.push({
        action: 'time_changed',
        old: currentAppointment.appointment_time,
        new: appointment_time
      });
    }

    if (status) {
      updates.push('status = ?');
      values.push(status);
      historyLogs.push({
        action: 'status_changed',
        old: currentAppointment.status,
        new: status
      });
    }

    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    if (service_id) {
      const { rows: services } = await pool.query(
        'SELECT duration_minutes FROM services WHERE service_id = $1 AND clinic_id = $2',
        [service_id, clinic_id]
      );

      if (services.length > 0) {
        updates.push('service_id = ?');
        values.push(service_id);
        updates.push('duration_minutes = ?');
        values.push(services[0].duration_minutes);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    values.push(id, clinic_id);

    // SQL syntax for PostgreSQL updates with positional parameters
    const postgresUpdates = updates.map((u, i) => u.replace('?', `$${i + 1}`));
    const finalIdPlaceholder = `$${values.length - 1}`;
    const finalClinicIdPlaceholder = `$${values.length}`;

    await pool.query(
      `UPDATE appointments SET ${postgresUpdates.join(', ')} WHERE appointment_id = ${finalIdPlaceholder} AND clinic_id = ${finalClinicIdPlaceholder}`,
      values
    );

    for (const log of historyLogs) {
      await pool.query(
        `INSERT INTO appointment_history (appointment_id, action, old_value, new_value, performed_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, log.action, log.old, log.new, clinic_id, 'Updated via dashboard']
      );
    }

    const { rows: appointments } = await pool.query(
      `SELECT a.*, p.name as patient_name, s.service_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.appointment_id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Appointment updated successfully',
      data: { appointment: appointments[0] }
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment.'
    });
  }
};

// Delete appointment (UNCHANGED)
const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const clinic_id = req.clinic.clinic_id;

    const result = await pool.query(
      "UPDATE appointments SET status = 'cancelled' WHERE appointment_id = $1 AND clinic_id = $2",
      [id, clinic_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.'
      });
    }

    await pool.query(
      `INSERT INTO appointment_history (appointment_id, action, new_value, performed_by, notes)
       VALUES ($1, 'cancelled', 'cancelled', $2, 'Appointment cancelled')`,
      [id, clinic_id]
    );

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment.'
    });
  }
};

// Get available time slots (FIXED)
const getAvailableSlots = async (req, res) => {
  try {
    const date = req.query.date;
    const service_id = req.query.service_id || req.query.serviceId;
    const clinic_id = req.clinic.clinic_id;

    if (!date || !service_id) {
      return res.status(400).json({
        success: false,
        message: 'Date and service_id are required.'
      });
    }

    const { rows: clinics } = await pool.query(
      'SELECT working_hours_start, working_hours_end, working_days FROM clinics WHERE clinic_id = $1',
      [clinic_id]
    );

    if (clinics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found.'
      });
    }

    const clinic = clinics[0];
    const workingStart = clinic.working_hours_start || '09:00:00';
    const workingEnd = clinic.working_hours_end || '18:00:00';

    // Normalize working_days to an array of numbers (0=Sun, 1=Mon, ... 6=Sat)
    let workingDays;
    try {
      workingDays = JSON.parse(clinic.working_days);
      if (!Array.isArray(workingDays)) workingDays = clinic.working_days.split(',').map((d) => parseInt(d.trim(), 10)).filter((n) => !Number.isNaN(n));
      else workingDays = workingDays.map((d) => parseInt(d, 10)).filter((n) => !Number.isNaN(n));
    } catch (err) {
      workingDays = (typeof clinic.working_days === 'string' ? clinic.working_days.split(',') : []).map((d) => parseInt(String(d).trim(), 10)).filter((n) => !Number.isNaN(n));
    }
    if (workingDays.length === 0) {
      workingDays = [1, 2, 3, 4, 5, 6];
    }

    // Check if clinic works on the selected day
    const [year, month, day] = date.split('-').map(Number);
    const selectedDay = new Date(year, month - 1, day).getDay();
    if (!workingDays.includes(selectedDay)) {
      return res.json({
        success: true,
        data: {
          date,
          slots: [],
          message: 'Clinic closed on this day'
        }
      });
    }

    const { rows: services } = await pool.query(
      'SELECT duration_minutes FROM services WHERE service_id = $1 AND clinic_id = $2',
      [service_id, clinic_id]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    const serviceDuration = services[0].duration_minutes;

    const { rows: existingAppointments } = await pool.query(
      `SELECT appointment_time, duration_minutes 
       FROM appointments 
       WHERE clinic_id = $1 AND appointment_date = $2 AND status IN ('scheduled', 'confirmed')
       ORDER BY appointment_time`,
      [clinic_id, date]
    );

    const slots = generateTimeSlots(
      workingStart,
      workingEnd,
      serviceDuration,
      existingAppointments,
      date,
      clinic.timezone || 'Asia/Kolkata'
    );

    res.json({
      success: true,
      data: {
        date,
        service_duration: serviceDuration,
        working_hours: {
          start: clinic.working_hours_start,
          end: clinic.working_hours_end
        },
        slots
      }
    });

  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available slots.'
    });
  }
};

// Helper function to check time slot availability (UNCHANGED)
const checkTimeSlotAvailability = async (clinic_id, date, time, duration, excludeAppointmentId = null) => {
  const { rows: existingAppointments } = await pool.query(
    `SELECT appointment_time, duration_minutes 
     FROM appointments 
     WHERE clinic_id = $1 AND appointment_date = $2 AND status IN ('scheduled', 'confirmed')
     ${excludeAppointmentId ? 'AND appointment_id != $3' : ''}
     ORDER BY appointment_time`,
    excludeAppointmentId ? [clinic_id, date, excludeAppointmentId] : [clinic_id, date]
  );

  const requestedStart = timeToMinutes(time);
  const requestedEnd = requestedStart + duration;

  for (const appt of existingAppointments) {
    const apptStart = timeToMinutes(appt.appointment_time);
    const apptEnd = apptStart + appt.duration_minutes;

    if (requestedStart < apptEnd && requestedEnd > apptStart) {
      return false;
    }
  }

  return true;
};

// Helper function to generate time slots (FIXED)
const generateTimeSlots = (workingStart, workingEnd, serviceDuration, existingAppointments, date, timezone = 'Asia/Kolkata') => {
  const slots = [];
  const startMinutes = timeToMinutes(workingStart);
  const endMinutes = timeToMinutes(workingEnd);

  // Timezone-aware "today" and "current time" check
  const now = new Date();
  let localDate, localHours, localMinutes;

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    localDate = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
    localHours = parseInt(parts.find(p => p.type === 'hour').value, 10);
    localMinutes = parseInt(parts.find(p => p.type === 'minute').value, 10);
  } catch (e) {
    // Fallback if timezone is invalid
    localDate = now.toISOString().split('T')[0];
    localHours = now.getHours();
    localMinutes = now.getMinutes();
  }

  const isToday = date === localDate;
  const currentMinutes = isToday ? (localHours * 60 + localMinutes) : 0;

  for (let time = startMinutes; time + serviceDuration <= endMinutes; time += serviceDuration) {
    const slotTime = minutesToTime(time);
    const slotEnd = time + serviceDuration;

    if (isToday && time <= currentMinutes) {
      continue;
    }

    let isAvailable = true;
    for (const appt of existingAppointments) {
      const apptStart = timeToMinutes(appt.appointment_time);
      const apptEnd = apptStart + appt.duration_minutes;

      if (time < apptEnd && slotEnd > apptStart) {
        isAvailable = false;
        break;
      }
    }

    slots.push({
      time: slotTime,
      end_time: minutesToTime(slotEnd),
      available: isAvailable
    });
  }

  return slots;
};

const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Get today's appointments
const getTodayAppointments = async (req, res) => {
  try {
    const clinic_id = req.clinic.clinic_id;

    const { rows: appointments } = await pool.query(
      `SELECT a.*, 
              p.name as patient_name, p.phone as patient_phone,
              s.service_name, s.color_code
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1 AND a.appointment_date = CURRENT_DATE
       ORDER BY a.appointment_time`,
      [clinic_id]
    );

    res.json({
      success: true,
      data: { appointments }
    });
  } catch (error) {
    console.error('Get today appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s appointments.'
    });
  }
};

// Get upcoming appointments
const getUpcomingAppointments = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const clinic_id = req.clinic.clinic_id;
    const limitNum = clamp(toSafeInt(limit, 10), 1, 200);

    const { rows: appointments } = await pool.query(
      `SELECT a.*, 
              p.name as patient_name, p.phone as patient_phone,
              s.service_name, s.color_code
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.clinic_id = $1 
         AND a.appointment_date >= CURRENT_DATE
         AND a.status IN ('scheduled', 'confirmed')
       ORDER BY a.appointment_date, a.appointment_time
       LIMIT ${limitNum}`,
      [clinic_id]
    );

    res.json({
      success: true,
      data: { appointments }
    });
  } catch (error) {
    console.error('Get upcoming appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming appointments.'
    });
  }
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