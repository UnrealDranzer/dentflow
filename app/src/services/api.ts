import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://dentflow.onrender.com/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Request interceptor – attach auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor – handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { clinic_name: string; email: string; phone: string; password: string }) =>
    api.post('auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('auth/login', data),
  getMe: () =>
    api.get('auth/me'),
  logout: () =>
    api.post('auth/logout'),
};

// ─── Clinic Settings API ─────────────────────────────────────────────────────
export const clinicAPI = {
  getSettings: () =>
    api.get('clinics/settings'),
  updateProfile: (data: Partial<Clinic>) =>
    api.put('clinics/settings/profile', data),
  updateWorkingHours: (data: { working_hours_start?: string; working_hours_end?: string; working_days?: number[]; slot_interval_minutes?: number }) =>
    api.put('clinics/settings/working-hours', data),
  updateNotifications: (data: { sms_enabled?: boolean; whatsapp_enabled?: boolean; google_review_link?: string }) =>
    api.put('clinics/settings/notifications', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.put('clinics/settings/password', data),
};

// ─── Patients API ─────────────────────────────────────────────────────────────
export const patientsAPI = {
  getAll: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get('patients', { params }),
  getById: (id: number) =>
    api.get(`patients/${id}`),
  create: (data: Partial<Patient>) =>
    api.post('patients', data),
  update: (id: number, data: Partial<Patient>) =>
    api.put(`patients/${id}`, data),
  delete: (id: number) =>
    api.delete(`patients/${id}`),
  getStats: () =>
    api.get('patients/stats'),
};

// ─── Services API ─────────────────────────────────────────────────────────────
export const servicesAPI = {
  getAll: (params?: { active_only?: boolean }) =>
    api.get('services', { params }),
  getById: (id: number) =>
    api.get(`services/${id}`),
  create: (data: Partial<Service>) =>
    api.post('services', data),
  update: (id: number, data: Partial<Service>) =>
    api.put(`services/${id}`, data),
  delete: (id: number) =>
    api.delete(`services/${id}`),
  getPopular: () =>
    api.get('services/popular'),
};

// ─── Doctors API ──────────────────────────────────────────────────────────────
export const doctorsAPI = {
  getAll: (params?: { search?: string; active_only?: boolean }) =>
    api.get('doctors', { params }),
  getById: (id: number) =>
    api.get(`doctors/${id}`),
  create: (data: Partial<Doctor> & {
    working_days?: number[];
    start_time?: string;
    end_time?: string;
    break_start?: string;
    break_end?: string;
    slot_interval?: number;
  }) =>
    api.post('doctors', data),
  update: (id: number, data: Partial<Doctor> & {
    working_days?: number[];
    start_time?: string;
    end_time?: string;
    break_start?: string;
    break_end?: string;
    slot_interval?: number;
    is_active?: boolean;
  }) =>
    api.put(`doctors/${id}`, data),
  delete: (id: number) =>
    api.delete(`doctors/${id}`),
  updateAvailability: (id: number, data: {
    working_days: number[];
    start_time: string;
    end_time: string;
    break_start?: string;
    break_end?: string;
    slot_interval?: number;
  }) =>
    api.put(`doctors/${id}/availability`, data),
  addLeave: (id: number, data: { leave_date: string; reason?: string }) =>
    api.post(`doctors/${id}/leaves`, data),
  removeLeave: (doctorId: number, leaveId: number) =>
    api.delete(`doctors/${doctorId}/leaves/${leaveId}`),
  getAvailableSlots: (id: number, params: { date: string; service_id: number }) =>
    api.get(`doctors/${id}/available-slots`, { params }),
};

// ─── Appointments API ─────────────────────────────────────────────────────────
export const appointmentsAPI = {
  getAll: (params?: { date?: string; status?: string; patient_id?: number; doctor_id?: number; page?: number; limit?: number }) =>
    api.get('appointments', { params }),
  getById: (id: number) =>
    api.get(`appointments/${id}`),
  create: (data: Partial<Appointment>) =>
    api.post('appointments', data),
  update: (id: number, data: Partial<Appointment>) =>
    api.put(`appointments/${id}`, data),
  delete: (id: number) =>
    api.delete(`appointments/${id}`),
  getAvailableSlots: (params: { date: string; service_id: number; doctor_id?: number }) =>
    api.get('appointments/available-slots', { params }),
  getToday: () =>
    api.get('appointments/today'),
  getUpcoming: (params?: { limit?: number }) =>
    api.get('appointments/upcoming', { params }),
};

// ─── Analytics API ────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getDashboardOverview: () =>
    api.get('analytics/dashboard'),
  getAppointmentStats: (params?: { start_date?: string; end_date?: string }) =>
    api.get('analytics/appointments', { params }),
  getRevenueAnalytics: (params?: { period?: string }) =>
    api.get('analytics/revenue', { params }),
  getPatientAnalytics: () =>
    api.get('analytics/patients'),
};

// ─── Public API (no auth required) ───────────────────────────────────────────
export const publicAPI = {
  getClinicInfo: (clinicSlug: string) =>
    api.get(`public/clinic/${clinicSlug}`),
  getAvailableSlots: (params: { clinic_id: number; date: string; service_id: number; doctor_id?: number }) =>
    api.get(`public/available-slots`, { params }),
  bookAppointment: (data: Partial<AppointmentBooking>) =>
    api.post(`public/book-appointment`, data),
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Clinic {
  clinic_id: number;
  clinic_name: string;
  clinic_slug?: string;
  email: string;
  phone: string;
  subscription_plan: string;
  subscription_status: string;
  working_hours_start?: string;
  working_hours_end?: string;
  working_days?: number[];
  slot_interval_minutes?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  website?: string;
  google_review_link?: string;
  logo_url?: string;
  timezone?: string;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
}

export interface Patient {
  patient_id: number;
  clinic_id: number;
  name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  city?: string;
  state?: string;
  medical_history?: string;
  allergies?: string;
  notes?: string;
  last_visit?: string;
  total_visits: number;
  total_spent: number;
  created_at: string;
}

export interface Service {
  service_id: number;
  clinic_id: number;
  service_name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  color_code: string;
  is_active: boolean;
  created_at: string;
}

export interface Doctor {
  doctor_id: number;
  clinic_id: number;
  name: string;
  specialization?: string;
  phone?: string;
  email?: string;
  qualification?: string;
  experience_years?: number;
  color_tag?: string;
  photo_url?: string;
  is_active: boolean;
  // from availability join
  working_days?: number[];
  start_time?: string;
  end_time?: string;
  break_start?: string;
  break_end?: string;
  slot_interval?: number;
  created_at: string;
}

export interface Appointment {
  appointment_id: number;
  clinic_id: number;
  patient_id: number;
  service_id: number;
  doctor_id?: number;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  price?: number;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
  notes?: string;
  reminder_sent: boolean;
  source: string;
  patient_name?: string;
  patient_phone?: string;
  service_name?: string;
  color_code?: string;
  doctor_name?: string;
  doctor_color?: string;
  created_at: string;
}

export interface AppointmentBooking {
  clinic_id: number;
  name: string;
  phone: string;
  email?: string;
  service_id: number;
  doctor_id?: number;
  appointment_date: string;
  appointment_time: string;
  notes?: string;
}

export default api;
