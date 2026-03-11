-- DentFlow SaaS Database Schema
-- Multi-tenant Dental Clinic Management System

CREATE DATABASE IF NOT EXISTS dentflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dentflow;

-- Clinics table (Tenants)
CREATE TABLE IF NOT EXISTS clinics (
    clinic_id INT PRIMARY KEY AUTO_INCREMENT,
    clinic_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    subscription_plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
    subscription_status ENUM('active', 'inactive', 'suspended', 'cancelled') DEFAULT 'active',
    subscription_expires_at TIMESTAMP NULL,
    working_hours_start TIME DEFAULT '09:00:00',
    working_hours_end TIME DEFAULT '18:00:00',
    working_days JSON DEFAULT '[1,2,3,4,5,6]',
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    currency VARCHAR(10) DEFAULT 'INR',
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    logo_url VARCHAR(500),
    website VARCHAR(255),
    google_review_link VARCHAR(500),
    sms_enabled BOOLEAN DEFAULT false,
    whatsapp_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT true,
    INDEX idx_email (email),
    INDEX idx_subscription (subscription_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Services/Treatments table
CREATE TABLE IF NOT EXISTS services (
    service_id INT PRIMARY KEY AUTO_INCREMENT,
    clinic_id INT NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    color_code VARCHAR(7) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    INDEX idx_clinic_service (clinic_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    clinic_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    notes TEXT,
    last_visit DATE,
    total_visits INT DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    INDEX idx_clinic_patient (clinic_id, phone),
    INDEX idx_clinic_email (clinic_id, email),
    INDEX idx_last_visit (clinic_id, last_visit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,
    clinic_id INT NOT NULL,
    patient_id INT NOT NULL,
    service_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled') DEFAULT 'scheduled',
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    reminder_sent_at TIMESTAMP NULL,
    confirmation_status ENUM('pending', 'confirmed', 'declined') DEFAULT 'pending',
    source ENUM('dashboard', 'public_booking', 'walk_in', 'phone') DEFAULT 'dashboard',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
    INDEX idx_clinic_date (clinic_id, appointment_date),
    INDEX idx_clinic_status (clinic_id, status),
    INDEX idx_patient (patient_id),
    INDEX idx_date_time (appointment_date, appointment_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appointment history log
CREATE TABLE IF NOT EXISTS appointment_history (
    history_id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    performed_by INT,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    INDEX idx_appointment (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications/SMS/WhatsApp log
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    clinic_id INT NOT NULL,
    patient_id INT NOT NULL,
    appointment_id INT,
    type ENUM('sms', 'whatsapp', 'email', 'push') NOT NULL,
    purpose ENUM('reminder', 'confirmation', 'follow_up', 'cancellation', 'custom') NOT NULL,
    content TEXT NOT NULL,
    status ENUM('pending', 'sent', 'failed', 'delivered') DEFAULT 'pending',
    external_id VARCHAR(255),
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    INDEX idx_clinic_type (clinic_id, type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Analytics/Summary table (for faster dashboard queries)
CREATE TABLE IF NOT EXISTS daily_analytics (
    analytics_id INT PRIMARY KEY AUTO_INCREMENT,
    clinic_id INT NOT NULL,
    date DATE NOT NULL,
    total_appointments INT DEFAULT 0,
    completed_appointments INT DEFAULT 0,
    cancelled_appointments INT DEFAULT 0,
    no_show_appointments INT DEFAULT 0,
    new_patients INT DEFAULT 0,
    returning_patients INT DEFAULT 0,
    total_revenue DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    UNIQUE KEY unique_clinic_date (clinic_id, date),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for testing
INSERT INTO clinics (clinic_name, email, phone, password_hash, subscription_plan, working_hours_start, working_hours_end, google_review_link) VALUES
('Dr. Sharma Dental Care', 'dr.sharma@example.com', '+919876543210', '$2a$10$YourHashedPasswordHere', 'premium', '09:00:00', '18:00:00', 'https://g.page/review-link'),
('City Dental Clinic', 'city.dental@example.com', '+919876543211', '$2a$10$YourHashedPasswordHere', 'basic', '10:00:00', '20:00:00', 'https://g.page/review-link');

-- Insert sample services
INSERT INTO services (clinic_id, service_name, description, duration_minutes, price, color_code) VALUES
(1, 'Teeth Cleaning', 'Professional dental cleaning and polishing', 30, 1500.00, '#10B981'),
(1, 'Root Canal Treatment', 'Complete root canal procedure', 60, 5000.00, '#EF4444'),
(1, 'Braces Consultation', 'Initial consultation for orthodontic treatment', 45, 1000.00, '#8B5CF6'),
(1, 'Tooth Extraction', 'Simple tooth extraction procedure', 30, 2000.00, '#F59E0B'),
(1, 'Dental Filling', 'Cavity filling with composite material', 45, 2500.00, '#3B82F6'),
(1, 'Teeth Whitening', 'Professional teeth whitening session', 60, 8000.00, '#EC4899');

-- Insert sample patients
INSERT INTO patients (clinic_id, name, phone, email, date_of_birth, gender, address, city, notes) VALUES
(1, 'Rahul Kumar', '+919876543212', 'rahul@example.com', '1990-05-15', 'male', '123 Main Street', 'Mumbai', 'Regular patient, prefers morning appointments'),
(1, 'Priya Singh', '+919876543213', 'priya@example.com', '1985-08-22', 'female', '456 Park Avenue', 'Mumbai', 'Has dental anxiety, needs extra care'),
(1, 'Amit Patel', '+919876543214', 'amit@example.com', '1978-12-10', 'male', '789 Garden Road', 'Mumbai', 'High blood pressure, inform doctor'),
(1, 'Sneha Gupta', '+919876543215', 'sneha@example.com', '1995-03-28', 'female', '321 Lake View', 'Mumbai', 'First-time patient');

-- Insert sample appointments
INSERT INTO appointments (clinic_id, patient_id, service_id, appointment_date, appointment_time, duration_minutes, status, notes, source) VALUES
(1, 1, 1, CURDATE(), '10:00:00', 30, 'scheduled', 'Regular cleaning', 'dashboard'),
(1, 2, 2, CURDATE() + INTERVAL 1 DAY, '11:30:00', 60, 'scheduled', 'Follow-up root canal', 'dashboard'),
(1, 3, 4, CURDATE() + INTERVAL 2 DAY, '14:00:00', 30, 'scheduled', 'Wisdom tooth extraction', 'public_booking'),
(1, 4, 3, CURDATE() - INTERVAL 5 DAY, '09:30:00', 45, 'completed', 'Initial consultation done', 'dashboard'),
(1, 1, 5, CURDATE() - INTERVAL 10 DAY, '16:00:00', 45, 'completed', 'Filling done for cavity', 'dashboard');

-- Update patient last_visit
UPDATE patients SET last_visit = CURDATE() - INTERVAL 5 DAY WHERE patient_id = 4;
UPDATE patients SET last_visit = CURDATE() - INTERVAL 10 DAY, total_visits = 2 WHERE patient_id = 1;
