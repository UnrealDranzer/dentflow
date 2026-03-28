export interface NormalizedAppointment {
  appointment_id: string;
  clinic_id: string;
  patient_id: string;
  dentist_id?: string | null;
  scheduled_at?: string | null;
  appointment_time?: string | null;
  duration_mins?: number;
  status?: string;
  type?: string;
  notes?: string | null;
  treatment_done?: string | null;
  amount?: number;
  created_at?: string | null;
  patient_name?: string;
  doctor_name?: string;
  patient_phone?: string;
  patient_email?: string;
  service_id?: string;
  service_name?: string;
  service_price?: number;
  appointment_date?: string;
  color_code?: string;
  reminder_sent?: boolean;
  source?: string;
}

export const normalizeAppointment = (raw: any): NormalizedAppointment => {
  if (!raw || typeof raw !== 'object') {
    return {
      appointment_id: 'unknown',
      clinic_id: '',
      patient_id: ''
    };
  }

  // Safely extract and stringify IDs
  const appointment_id = String(raw.appointment_id || raw.id || 'unknown');
  const clinic_id = raw.clinic_id ? String(raw.clinic_id) : '';
  const patient_id = raw.patient_id ? String(raw.patient_id) : '';
  const dentist_id = (raw.dentist_id || raw.doctor_id) ? String(raw.dentist_id || raw.doctor_id) : null;
  const service_id = raw.service_id ? String(raw.service_id) : undefined;

  // Safely derive time/date if one is missing but the other exists
  let appointment_time = raw.appointment_time || null;
  let scheduled_at = raw.scheduled_at || raw.appointment_date || null;
  let appointment_date = raw.appointment_date || raw.scheduled_at || null;

  if (!appointment_time && scheduled_at && typeof scheduled_at === 'string' && scheduled_at.includes('T')) {
    // Attempt to extract time from ISO string
    try {
      const d = new Date(scheduled_at);
      if (!isNaN(d.getTime())) {
        appointment_time = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Parse numbers safely
  const amount = raw.amount !== undefined ? parseFloat(String(raw.amount)) : (raw.service_price !== undefined ? parseFloat(String(raw.service_price)) : 0);
  const duration_mins = raw.duration_mins !== undefined ? parseInt(String(raw.duration_mins), 10) : (raw.duration_minutes !== undefined ? parseInt(String(raw.duration_minutes), 10) : 30);

  return {
    appointment_id,
    clinic_id,
    patient_id,
    dentist_id,
    service_id,
    scheduled_at,
    appointment_time,
    appointment_date,
    duration_mins: isNaN(duration_mins) ? 30 : duration_mins,
    status: raw.status || 'scheduled',
    type: raw.type || 'consultation',
    notes: raw.notes || null,
    treatment_done: raw.treatment_done || null,
    amount: isNaN(amount) ? 0 : amount,
    created_at: raw.created_at || null,
    patient_name: raw.patient_name || raw.patient?.name || 'Unknown Patient',
    doctor_name: raw.doctor_name || raw.doctor?.name || 'Unknown Doctor',
    patient_phone: raw.patient_phone || raw.patient?.phone || '',
    patient_email: raw.patient_email || raw.patient?.email || '',
    service_name: raw.service_name || raw.service?.name || 'Consultation',
    service_price: isNaN(amount) ? 0 : amount,
    color_code: raw.color_code || '#3B82F6',
    reminder_sent: !!raw.reminder_sent,
    source: raw.source || 'system'
  };
};

export const normalizeAppointments = (rows: any[] = []): NormalizedAppointment[] => {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeAppointment);
};
