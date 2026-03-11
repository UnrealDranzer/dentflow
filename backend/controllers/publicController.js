const { pool } = require('../config/database');
const { queueAppointmentReminders } = require('../utils/notificationService');

const parseWorkingDays = (value) => {
  const fallback = [1, 2, 3, 4, 5, 6];
  if (value == null) return fallback;

  // mysql2 may return JSON as string, Buffer, or already-parsed value depending on config/version
  const raw =
    Buffer.isBuffer(value) ? value.toString('utf8') : value;

  if (Array.isArray(raw)) {
    const days = raw.map((d) => Number(d)).filter((n) => Number.isFinite(n));
    return days.length ? days : fallback;
  }

  if (typeof raw === 'number') return [raw];

  if (typeof raw !== 'string') return fallback;

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // First try proper JSON (e.g. "[1,2,3,4,5,6]")
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const days = parsed.map((d) => Number(d)).filter((n) => Number.isFinite(n));
      return days.length ? days : fallback;
    }
  } catch (_) {
    // ignore and try CSV-style parsing below
  }

  // Accept "1,2,3,4,5,6" or "[1,2,3]" or "1 2 3" variants
  const cleaned = trimmed.replace(/^\[|\]$/g, '');
  const days = cleaned
    .split(/[,\s]+/)
    .map((d) => Number(d))
    .filter((n) => Number.isFinite(n));
  return days.length ? days : fallback;
};

// Get clinic public info
const getClinicPublicInfo = async (req, res) => {
  try {
    const { clinic_id } = req.params;

    const [clinics] = await pool.execute(
      `SELECT clinic_id, clinic_name, phone, working_hours_start, working_hours_end, 
              working_days, address, city, state, website, logo_url
       FROM clinics 
       WHERE clinic_id = ? AND is_active = true AND subscription_status = 'active'`,
      [clinic_id]
    );

    if (clinics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found or inactive.'
      });
    }

    // Get active services
    const [services] = await pool.execute(
      'SELECT service_id, service_name, description, duration_minutes, price FROM services WHERE clinic_id = ? AND is_active = true',
      [clinic_id]
    );

    res.json({
      success: true,
      data: {
        clinic: clinics[0],
        services
      }
    });
  } catch (error) {
    console.error('Get clinic public info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clinic information.'
    });
  }
};

// Public booking
const bookAppointment = async (req, res) => {
  try {
    const { clinic_id, name, phone, email, service_id, appointment_date, appointment_time, notes } = req.body;

    // Verify clinic exists and is active
    const [clinics] = await pool.execute(
      'SELECT clinic_id, working_hours_start, working_hours_end, working_days FROM clinics WHERE clinic_id = ? AND is_active = true',
      [clinic_id]
    );

    if (clinics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found or inactive.'
      });
    }

    const clinic = clinics[0];

    // Check if clinic is open on the selected day
    const workingDays = parseWorkingDays(clinic.working_days);
    const dayOfWeek = new Date(appointment_date).getDay();
    
    if (!workingDays.includes(dayOfWeek)) {
      return res.status(400).json({
        success: false,
        message: 'Clinic is closed on the selected day.'
      });
    }

    // Get service details
    const [services] = await pool.execute(
      'SELECT duration_minutes, price FROM services WHERE service_id = ? AND clinic_id = ? AND is_active = true',
      [service_id, clinic_id]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or inactive.'
      });
    }

    const serviceDuration = services[0].duration_minutes;

    // Check if time slot is available
    const isAvailable = await checkTimeSlotAvailability(
      clinic_id, 
      appointment_date, 
      appointment_time, 
      serviceDuration
    );

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        message: 'This time slot is no longer available. Please select a different time.'
      });
    }

    // Find or create patient
    let patient_id;
    const [existingPatients] = await pool.execute(
      'SELECT patient_id FROM patients WHERE clinic_id = ? AND phone = ?',
      [clinic_id, phone]
    );

    if (existingPatients.length > 0) {
      patient_id = existingPatients[0].patient_id;
      
      // Update patient info if needed
      if (email) {
        await pool.execute(
          'UPDATE patients SET email = ?, name = ? WHERE patient_id = ?',
          [email, name, patient_id]
        );
      }
    } else {
      // Create new patient
      const [patientResult] = await pool.execute(
        'INSERT INTO patients (clinic_id, name, phone, email) VALUES (?, ?, ?, ?)',
        [clinic_id, name, phone, email]
      );
      patient_id = patientResult.insertId;
    }

    // Create appointment
    const [appointmentResult] = await pool.execute(
      `INSERT INTO appointments (clinic_id, patient_id, service_id, appointment_date, appointment_time, 
        duration_minutes, status, notes, source)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, 'public_booking')`,
      [clinic_id, patient_id, service_id, appointment_date, appointment_time, serviceDuration, notes]
    );

    const appointment_id = appointmentResult.insertId;

    // Get appointment details
    const [appointments] = await pool.execute(
      `SELECT a.*, p.name as patient_name, p.phone as patient_phone, s.service_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.patient_id
       JOIN services s ON a.service_id = s.service_id
       WHERE a.appointment_id = ?`,
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
      message: 'Appointment booked successfully',
      data: { appointment: appointments[0] }
    });
  } catch (error) {
    console.error('Book appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book appointment. Please try again.'
    });
  }
};

// Get available slots for public booking
const getPublicAvailableSlots = async (req, res) => {
  try {
    const { clinic_id, date, service_id } = req.query;

    if (!clinic_id || !date || !service_id) {
      return res.status(400).json({
        success: false,
        message: 'clinic_id, date, and service_id are required.'
      });
    }

    // Get clinic working hours
    const [clinics] = await pool.execute(
      'SELECT working_hours_start, working_hours_end, working_days FROM clinics WHERE clinic_id = ? AND is_active = true',
      [clinic_id]
    );

    if (clinics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found.'
      });
    }

    const clinic = clinics[0];
    const workingDays = parseWorkingDays(clinic.working_days);
    const dayOfWeek = new Date(date).getDay();
    
    // Check if clinic is open on this day
    if (!workingDays.includes(dayOfWeek)) {
      return res.json({
        success: true,
        data: {
          slots: [],
          message: 'Clinic is closed on this day'
        }
      });
    }

    // Get service duration
    const [services] = await pool.execute(
      'SELECT duration_minutes FROM services WHERE service_id = ? AND clinic_id = ? AND is_active = true',
      [service_id, clinic_id]
    );

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.'
      });
    }

    const serviceDuration = services[0].duration_minutes;

    // Get existing appointments
    const [existingAppointments] = await pool.execute(
      `SELECT appointment_time, duration_minutes 
       FROM appointments 
       WHERE clinic_id = ? AND appointment_date = ? AND status IN ('scheduled', 'confirmed')
       ORDER BY appointment_time`,
      [clinic_id, date]
    );

    // Generate available slots
    const slots = generateTimeSlots(
      clinic.working_hours_start,
      clinic.working_hours_end,
      serviceDuration,
      existingAppointments,
      date
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
    console.error('Get public available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available slots.'
    });
  }
};

// Helper function to check time slot availability
const checkTimeSlotAvailability = async (clinic_id, date, time, duration) => {
  const [existingAppointments] = await pool.execute(
    `SELECT appointment_time, duration_minutes 
     FROM appointments 
     WHERE clinic_id = ? AND appointment_date = ? AND status IN ('scheduled', 'confirmed')
     ORDER BY appointment_time`,
    [clinic_id, date]
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

// Helper function to generate time slots
const generateTimeSlots = (workingStart, workingEnd, serviceDuration, existingAppointments, date) => {
  const slots = [];
  const startMinutes = timeToMinutes(workingStart);
  const endMinutes = timeToMinutes(workingEnd);
  
  // Check if date is today
  const isToday = date === new Date().toISOString().split('T')[0];
  const currentMinutes = isToday ? (new Date().getHours() * 60 + new Date().getMinutes()) : 0;

  for (let time = startMinutes; time + serviceDuration <= endMinutes; time += 30) {
    const slotTime = minutesToTime(time);
    const slotEnd = time + serviceDuration;

    // Skip slots in the past for today
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

module.exports = {
  getClinicPublicInfo,
  bookAppointment,
  getPublicAvailableSlots
};
