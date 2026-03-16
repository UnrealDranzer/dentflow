-- DentFlow SaaS – PostgreSQL Schema
-- Multi-tenant Dental Clinic Management System

-- Clinics table (Tenants)
CREATE TABLE IF NOT EXISTS clinics (
    clinic_id     SERIAL PRIMARY KEY,
    clinic_name   VARCHAR(255) NOT NULL,
    clinic_slug   VARCHAR(100) UNIQUE,
    email         VARCHAR(255) UNIQUE NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    subscription_plan   VARCHAR(20) DEFAULT 'free',
    subscription_status VARCHAR(20) DEFAULT 'active',
    subscription_expires_at TIMESTAMPTZ,
    working_hours_start TIME    DEFAULT '09:00:00',
    working_hours_end   TIME    DEFAULT '18:00:00',
    working_days        JSONB   DEFAULT '[1,2,3,4,5,6]',
    slot_interval_minutes INT   DEFAULT 30,
    timezone        VARCHAR(50) DEFAULT 'Asia/Kolkata',
    currency        VARCHAR(10) DEFAULT 'INR',
    address         TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100),
    postal_code     VARCHAR(20),
    logo_url        VARCHAR(500),
    website         VARCHAR(255),
    google_review_link VARCHAR(500),
    sms_enabled       BOOLEAN DEFAULT false,
    whatsapp_enabled  BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_clinics_email ON clinics (email);
CREATE INDEX IF NOT EXISTS idx_clinics_slug  ON clinics (clinic_slug);

-- Doctors table
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id      SERIAL PRIMARY KEY,
    clinic_id      INT NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    specialization VARCHAR(255),
    phone          VARCHAR(20),
    email          VARCHAR(255),
    qualification  VARCHAR(255),
    experience_years INT,
    color_tag      VARCHAR(7)  DEFAULT '#3B82F6',
    photo_url      VARCHAR(500),
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctors_clinic ON doctors (clinic_id, is_active);

-- Doctor availability (per-doctor weekly schedule)
CREATE TABLE IF NOT EXISTS doctor_availability (
    id             SERIAL PRIMARY KEY,
    doctor_id      INT NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    clinic_id      INT NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    working_days   JSONB DEFAULT '[1,2,3,4,5,6]',
    start_time     TIME  DEFAULT '09:00:00',
    end_time       TIME  DEFAULT '18:00:00',
    break_start    TIME,
    break_end      TIME,
    slot_interval  INT   DEFAULT 30,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (doctor_id)
);

-- Doctor leave / unavailable dates
CREATE TABLE IF NOT EXISTS doctor_leaves (
    id          SERIAL PRIMARY KEY,
    doctor_id   INT NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    clinic_id   INT NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    leave_date  DATE NOT NULL,
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_leaves ON doctor_leaves (doctor_id, leave_date);

-- Services/Treatments table
CREATE TABLE IF NOT EXISTS services (
    service_id       SERIAL PRIMARY KEY,
    clinic_id        INT NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    service_name     VARCHAR(255) NOT NULL,
    description      TEXT,
    duration_minutes INT  NOT NULL DEFAULT 30,
    price            NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    color_code       VARCHAR(7)  DEFAULT '#3B82F6',
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_clinic ON services (clinic_id, is_active);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    patient_id    SERIAL PRIMARY KEY,
    clinic_id     INT NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    email         VARCHAR(255),
    date_of_birth DATE,
    gender        VARCHAR(10),
    address       TEXT,
    city          VARCHAR(100),
    state         VARCHAR(100),
    postal_code   VARCHAR(20),
    medical_history TEXT,
    allergies       TEXT,
    notes           TEXT,
    last_visit      DATE,
    total_visits    INT           DEFAULT 0,
    total_spent     NUMERIC(10,2) DEFAULT 0.00,
    created_at      TIMESTAMPTZ   DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone ON patients (clinic_id, phone);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_email ON patients (clinic_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patient_phone_clinic ON patients (clinic_id, phone);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id   SERIAL PRIMARY KEY,
    clinic_id        INT NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    patient_id       INT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    service_id       INT NOT NULL REFERENCES services(service_id) ON DELETE CASCADE,
    doctor_id        INT REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INT  NOT NULL DEFAULT 30,
    price            NUMERIC(10,2),
    status           VARCHAR(20) DEFAULT 'scheduled',
    notes            TEXT,
    reminder_sent    BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMPTZ,
    confirmation_status VARCHAR(20) DEFAULT 'pending',
    source           VARCHAR(20) DEFAULT 'dashboard',
    created_by       INT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appt_clinic_date   ON appointments (clinic_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appt_clinic_status ON appointments (clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_appt_patient        ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appt_doctor         ON appointments (doctor_id, appointment_date);

-- Appointment history log
CREATE TABLE IF NOT EXISTS appointment_history (
    history_id     SERIAL PRIMARY KEY,
    appointment_id INT NOT NULL REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    action         VARCHAR(50) NOT NULL,
    old_value      TEXT,
    new_value      TEXT,
    performed_by   INT,
    performed_at   TIMESTAMPTZ DEFAULT NOW(),
    notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_appt_history ON appointment_history (appointment_id);

-- Notifications log
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    clinic_id       INT NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    patient_id      INT NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    appointment_id  INT REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    type            VARCHAR(20) NOT NULL,
    purpose         VARCHAR(30) NOT NULL,
    content         TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',
    external_id     VARCHAR(255),
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_clinic ON notifications (clinic_id, type);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications (status);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Seed clinic (password: Admin@1234)
INSERT INTO clinics (
    clinic_name, clinic_slug, email, phone, password_hash,
    subscription_plan, working_hours_start, working_hours_end,
    working_days, slot_interval_minutes, google_review_link,
    address, city, state
) VALUES (
    'Dr. Sharma Dental Care',
    'dr-sharma-dental-care',
    'admin@dentflow.com',
    '+919876543210',
    '$2b$10$utO7RKs3oGYGKqEcA3tWl.ggy2Pi2Cy.Iw2UkEEfm1D5RD1d4ygD2',
    'premium',
    '09:00:00', '18:00:00',
    '[1,2,3,4,5,6]',
    30,
    'https://g.page/r/example-review-link',
    '123 Dental Street, Bandra',
    'Mumbai', 'Maharashtra'
) ON CONFLICT (email) DO NOTHING;

-- Seed doctors
INSERT INTO doctors (clinic_id, name, specialization, phone, email, qualification, experience_years, color_tag, is_active)
SELECT c.clinic_id, 'Dr. Rajiv Sharma', 'General Dentistry', '+919876543220', 'rajiv@dentflow.com', 'BDS, MDS', 12, '#3B82F6', true
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO doctors (clinic_id, name, specialization, phone, email, qualification, experience_years, color_tag, is_active)
SELECT c.clinic_id, 'Dr. Priya Mehta', 'Orthodontics', '+919876543221', 'priya@dentflow.com', 'BDS, MDS (Orthodontics)', 8, '#10B981', true
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

-- Seed doctor availability
INSERT INTO doctor_availability (doctor_id, clinic_id, working_days, start_time, end_time, break_start, break_end, slot_interval)
SELECT d.doctor_id, d.clinic_id, '[1,2,3,4,5,6]', '09:00:00', '18:00:00', '13:00:00', '14:00:00', 30
FROM doctors d WHERE d.email = 'rajiv@dentflow.com'
ON CONFLICT (doctor_id) DO NOTHING;

INSERT INTO doctor_availability (doctor_id, clinic_id, working_days, start_time, end_time, break_start, break_end, slot_interval)
SELECT d.doctor_id, d.clinic_id, '[1,2,3,4,5]', '10:00:00', '17:00:00', '13:00:00', '14:00:00', 30
FROM doctors d WHERE d.email = 'priya@dentflow.com'
ON CONFLICT (doctor_id) DO NOTHING;

-- Seed services
INSERT INTO services (clinic_id, service_name, description, duration_minutes, price, color_code)
SELECT c.clinic_id, 'Teeth Cleaning', 'Professional dental cleaning and polishing', 30, 1500.00, '#10B981'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO services (clinic_id, service_name, description, duration_minutes, price, color_code)
SELECT c.clinic_id, 'Root Canal Treatment', 'Complete root canal procedure', 60, 5000.00, '#EF4444'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO services (clinic_id, service_name, description, duration_minutes, price, color_code)
SELECT c.clinic_id, 'Braces Consultation', 'Initial consultation for orthodontic treatment', 45, 1000.00, '#8B5CF6'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO services (clinic_id, service_name, description, duration_minutes, price, color_code)
SELECT c.clinic_id, 'Tooth Extraction', 'Simple tooth extraction procedure', 30, 2000.00, '#F59E0B'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO services (clinic_id, service_name, description, duration_minutes, price, color_code)
SELECT c.clinic_id, 'Dental Filling', 'Cavity filling with composite material', 45, 2500.00, '#3B82F6'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO services (clinic_id, service_name, description, duration_minutes, price, color_code)
SELECT c.clinic_id, 'Teeth Whitening', 'Professional teeth whitening session', 60, 8000.00, '#EC4899'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

-- Seed patients
INSERT INTO patients (clinic_id, name, phone, email, date_of_birth, gender, city, notes)
SELECT c.clinic_id, 'Rahul Kumar', '+919876543212', 'rahul@example.com', '1990-05-15', 'male', 'Mumbai', 'Regular patient, prefers morning appointments'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO patients (clinic_id, name, phone, email, date_of_birth, gender, city, notes)
SELECT c.clinic_id, 'Priya Singh', '+919876543213', 'priya@example.com', '1985-08-22', 'female', 'Mumbai', 'Has dental anxiety, needs extra care'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO patients (clinic_id, name, phone, email, date_of_birth, gender, city, notes)
SELECT c.clinic_id, 'Amit Patel', '+919876543214', 'amit@example.com', '1978-12-10', 'male', 'Mumbai', 'High blood pressure, inform doctor'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;

INSERT INTO patients (clinic_id, name, phone, email, date_of_birth, gender, city, notes)
SELECT c.clinic_id, 'Sneha Gupta', '+919876543215', 'sneha@example.com', '1995-03-28', 'female', 'Mumbai', 'First-time patient'
FROM clinics c WHERE c.email = 'admin@dentflow.com'
ON CONFLICT DO NOTHING;
