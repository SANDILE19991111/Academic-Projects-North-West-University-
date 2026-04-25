-- =============================================
-- CLINICCARE — POSTGRESQL DATABASE SCHEMA
-- CMPG 311 Group 12 — Clinic Appointment System
-- Run this file in psql or pgAdmin:
--   psql -U postgres -d clinic_db -f schema.sql
-- =============================================

-- Create database (run separately if needed):
-- CREATE DATABASE clinic_db;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS AuditLog CASCADE;
DROP TABLE IF EXISTS DoctorAvailability CASCADE;
DROP TABLE IF EXISTS Waitlist CASCADE;
DROP TABLE IF EXISTS UserAccount CASCADE;
DROP TABLE IF EXISTS Inventory CASCADE;
DROP TABLE IF EXISTS Invoice CASCADE;
DROP TABLE IF EXISTS Prescription CASCADE;
DROP TABLE IF EXISTS Medical_Record CASCADE;
DROP TABLE IF EXISTS Appointment CASCADE;
DROP TABLE IF EXISTS Pharmacist CASCADE;
DROP TABLE IF EXISTS Doctor CASCADE;
DROP TABLE IF EXISTS Address CASCADE;
DROP TABLE IF EXISTS Staff CASCADE;
DROP TABLE IF EXISTS Patient CASCADE;

-- =============================================
-- PATIENT
-- =============================================
CREATE TABLE Patient (
  patient_id     SERIAL PRIMARY KEY,
  first_name     VARCHAR(50)  NOT NULL,
  surname        VARCHAR(50)  NOT NULL,
  dateofbirth    DATE         NOT NULL CHECK (dateofbirth < CURRENT_DATE),
  cell_no        VARCHAR(15)  NOT NULL UNIQUE CHECK (cell_no ~ '^[0-9+\- ]+$'),
  email          VARCHAR(100) UNIQUE,
  medical_history TEXT,
  allergies      TEXT,
  contact_info   VARCHAR(255),
  insurance_info VARCHAR(255),
  notification   BOOLEAN      DEFAULT FALSE,
  created_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patient_name    ON Patient (surname, first_name);
CREATE INDEX idx_patient_contact ON Patient (cell_no);

-- =============================================
-- ADDRESS (1-to-1 with Patient)
-- =============================================
CREATE TABLE Address (
  address_id  SERIAL PRIMARY KEY,
  patient_id  INT NOT NULL UNIQUE REFERENCES Patient(patient_id) ON DELETE CASCADE,
  street      VARCHAR(100) NOT NULL,
  suburb      VARCHAR(50),
  city        VARCHAR(50)  NOT NULL,
  zip_code    VARCHAR(10)  NOT NULL
);

-- =============================================
-- STAFF (supertype)
-- =============================================
CREATE TABLE Staff (
  staff_id    SERIAL PRIMARY KEY,
  phone       VARCHAR(15)  NOT NULL UNIQUE CHECK (phone ~ '^[0-9+\- ]+$'),
  email       VARCHAR(100) NOT NULL UNIQUE,
  schedule    TEXT,
  role        VARCHAR(50)  NOT NULL CHECK (role IN ('Doctor','Pharmacist','Nurse','Receptionist','Admin')),
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- DOCTOR (subtype of Staff)
-- =============================================
CREATE TABLE Doctor (
  doctor_id       SERIAL PRIMARY KEY,
  staff_id        INT NOT NULL UNIQUE REFERENCES Staff(staff_id) ON DELETE CASCADE,
  specialization  VARCHAR(100) NOT NULL,
  license_number  VARCHAR(50)  NOT NULL UNIQUE
);

-- =============================================
-- PHARMACIST (subtype of Staff)
-- =============================================
CREATE TABLE Pharmacist (
  pharmacist_id   SERIAL PRIMARY KEY,
  staff_id        INT NOT NULL UNIQUE REFERENCES Staff(staff_id) ON DELETE CASCADE,
  license_number  VARCHAR(50)  NOT NULL UNIQUE,
  specialization  VARCHAR(100)
);

-- =============================================
-- APPOINTMENT
-- =============================================
CREATE TABLE Appointment (
  appointment_id    SERIAL PRIMARY KEY,
  patient_id        INT NOT NULL REFERENCES Patient(patient_id)  ON DELETE CASCADE,
  doctor_id         INT NOT NULL REFERENCES Doctor(doctor_id)    ON DELETE CASCADE,
  datetime          TIMESTAMP    NOT NULL,
  duration          INTERVAL     DEFAULT '30 minutes',
  consultation_notes TEXT,
  status            VARCHAR(20)  NOT NULL DEFAULT 'Scheduled'
                    CHECK (status IN ('Scheduled','Completed','Cancelled','NoShow'))
);

CREATE INDEX idx_appt_datetime ON Appointment (datetime);
CREATE INDEX idx_appt_patient  ON Appointment (patient_id);
CREATE INDEX idx_appt_doctor   ON Appointment (doctor_id, status);

-- =============================================
-- MEDICAL RECORD
-- =============================================
CREATE TABLE Medical_Record (
  record_id           SERIAL PRIMARY KEY,
  patient_id          INT NOT NULL REFERENCES Patient(patient_id) ON DELETE CASCADE,
  doctor_id           INT NOT NULL REFERENCES Doctor(doctor_id)   ON DELETE SET NULL,
  lab_results         TEXT,
  treatment_plan      TEXT,
  diagnosis           VARCHAR(255),
  consultation_notes  TEXT,
  time_stamp          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_medical_patient ON Medical_Record (patient_id);

-- =============================================
-- PRESCRIPTION
-- =============================================
CREATE TABLE Prescription (
  prescription_id  SERIAL PRIMARY KEY,
  record_id        INT NOT NULL REFERENCES Medical_Record(record_id) ON DELETE CASCADE,
  medication       VARCHAR(100) NOT NULL,
  dosage           VARCHAR(50)  NOT NULL,
  frequency        VARCHAR(50)  NOT NULL,
  instructions     TEXT,
  dispensed_at     TIMESTAMP,
  status           VARCHAR(20)  NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending','Dispensed','Cancelled','Expired','Not Required')),
  last_updated_by  INT REFERENCES Staff(staff_id) ON DELETE SET NULL
);

-- =============================================
-- INVOICE
-- =============================================
CREATE TABLE Invoice (
  invoice_id      SERIAL PRIMARY KEY,
  patient_id      INT NOT NULL REFERENCES Patient(patient_id) ON DELETE CASCADE,
  total_amount    DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  payment_method  VARCHAR(50) CHECK (payment_method IN ('Cash','Credit Card','Medical Aid','Bank Transfer')),
  payment_status  VARCHAR(20) NOT NULL DEFAULT 'Unpaid'
                  CHECK (payment_status IN ('Paid','Unpaid','Pending','Partially Paid')),
  dateofbilling   DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by       INT REFERENCES Staff(staff_id) ON DELETE SET NULL
);

CREATE INDEX idx_invoice_patient ON Invoice (patient_id);
CREATE INDEX idx_invoice_status  ON Invoice (payment_status, dateofbilling);

-- =============================================
-- INVENTORY
-- =============================================
CREATE TABLE Inventory (
  item_id           SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  description       TEXT,
  stock_quant       INT NOT NULL DEFAULT 0 CHECK (stock_quant >= 0),
  reorder_level     INT NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_price        DECIMAL(10,2) CHECK (unit_price >= 0),
  expiry_date       DATE,
  supplier_info     JSONB,
  last_restock_date DATE
);

-- =============================================
-- USER ACCOUNT
-- =============================================
CREATE TABLE UserAccount (
  user_id         SERIAL PRIMARY KEY,
  staff_id        INT NOT NULL UNIQUE REFERENCES Staff(staff_id) ON DELETE CASCADE,
  username        VARCHAR(50)  NOT NULL UNIQUE CHECK (LENGTH(username) >= 5),
  password_hash   VARCHAR(255) NOT NULL,
  last_login      TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  failed_attempts INT DEFAULT 0
);

-- =============================================
-- AUDIT LOG
-- =============================================
CREATE TABLE AuditLog (
  log_id           SERIAL PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES UserAccount(user_id) ON DELETE CASCADE,
  action_type      VARCHAR(50) NOT NULL
                   CHECK (action_type IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT')),
  affected_table   VARCHAR(50) NOT NULL,
  record_id        INT,
  old_values       JSONB,
  new_values       JSONB,
  time_stamp       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ip_address       INET
);

-- =============================================
-- WAITLIST
-- =============================================
CREATE TABLE Waitlist (
  waitlist_id     SERIAL PRIMARY KEY,
  patient_id      INT NOT NULL REFERENCES Patient(patient_id) ON DELETE CASCADE,
  doctor_id       INT NOT NULL REFERENCES Doctor(doctor_id)   ON DELETE CASCADE,
  requested_date  DATE NOT NULL,
  priority        INT DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status          VARCHAR(20) NOT NULL DEFAULT 'Waiting'
                  CHECK (status IN ('Waiting','Confirmed','Cancelled')),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- DOCTOR AVAILABILITY
-- =============================================
CREATE TABLE DoctorAvailability (
  availability_id  SERIAL PRIMARY KEY,
  doctor_id        INT NOT NULL REFERENCES Doctor(doctor_id) ON DELETE CASCADE,
  available_date   DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL CHECK (end_time > start_time),
  slot_duration    INTERVAL DEFAULT '30 minutes',
  is_recurring     BOOLEAN DEFAULT FALSE
);

-- =============================================
-- VIEWS
-- =============================================

-- Active patient directory
CREATE OR REPLACE VIEW vw_active_patients AS
SELECT p.patient_id, p.first_name, p.surname, p.cell_no, p.email,
       a.city, a.zip_code,
       COUNT(DISTINCT app.appointment_id) AS total_appointments
FROM Patient p
LEFT JOIN Address a   ON p.patient_id = a.patient_id
LEFT JOIN Appointment app ON p.patient_id = app.patient_id
GROUP BY p.patient_id, a.address_id;

-- Doctor schedule view
CREATE OR REPLACE VIEW vw_doctor_schedule AS
SELECT d.doctor_id, s.email AS doctor_email, d.specialization,
       a.datetime AS appointment_time,
       p.first_name || ' ' || p.surname AS patient_name,
       a.status, a.consultation_notes
FROM Doctor d
JOIN Staff s      ON d.staff_id = s.staff_id
JOIN Appointment a ON d.doctor_id = a.doctor_id
JOIN Patient p    ON a.patient_id = p.patient_id
WHERE a.datetime >= CURRENT_DATE;

-- Financial summary view
CREATE OR REPLACE VIEW vw_financial_summary AS
SELECT
  EXTRACT(YEAR FROM dateofbilling)::INT  AS year,
  EXTRACT(MONTH FROM dateofbilling)::INT AS month,
  payment_method,
  COUNT(*)                               AS invoice_count,
  SUM(total_amount)                      AS total_revenue,
  SUM(CASE WHEN payment_status = 'Paid' THEN total_amount ELSE 0 END) AS paid_amount,
  SUM(CASE WHEN payment_status != 'Paid' THEN total_amount ELSE 0 END) AS outstanding
FROM Invoice
GROUP BY year, month, payment_method;

-- Inventory alerts view
CREATE OR REPLACE VIEW vw_inventory_alerts AS
SELECT item_id, name, stock_quant, reorder_level, unit_price,
  CASE
    WHEN stock_quant = 0                  THEN 'Out of Stock'
    WHEN stock_quant <= reorder_level     THEN 'Reorder Needed'
    ELSE 'In Stock'
  END AS status,
  expiry_date
FROM Inventory
WHERE stock_quant <= reorder_level
   OR expiry_date < CURRENT_DATE + INTERVAL '30 days';

-- =============================================
-- SEED DATA
-- =============================================

-- Patients
INSERT INTO Patient (first_name, surname, dateofbirth, cell_no, email, medical_history, allergies, insurance_info, notification) VALUES
('Alice',  'Smith',   '1990-05-20', '0712345678', 'alice@example.com',   'Hypertension', 'Penicillin', 'MediCare123', TRUE),
('Bob',    'Johnson', '1985-11-10', '0723456789', 'bob@example.com',     'Diabetes',     'None',        'HealthPlus',  FALSE),
('Clara',  'Ngwenya', '1992-08-14', '0734567890', 'clara@example.com',   'Asthma',       'Peanuts',     'BestHealth',  TRUE),
('Daniel', 'Mokoena', '1979-01-05', '0745678901', 'daniel@example.com',  'None',         'Latex',       'SA MedAid',   FALSE),
('Evelyn', 'Khumalo', '2000-12-25', '0756789012', 'evelyn@example.com',  'Migraines',    'Dust',        'LifeCover',   TRUE);

-- Addresses
INSERT INTO Address (patient_id, street, suburb, city, zip_code) VALUES
(1, '123 Main St',  'Sandton',     'Johannesburg', '2196'),
(2, '456 West Ave', 'Arcadia',     'Pretoria',     '0007'),
(3, '789 Elm Rd',   'Morningside', 'Durban',       '4001'),
(4, '12 Long St',   'Claremont',   'Cape Town',    '7708'),
(5, '44 High Rise', 'Polokwane',   'Polokwane',    '0699');

-- Staff
INSERT INTO Staff (phone, email, schedule, role) VALUES
('0781234567', 'dr.mokoena@clinic.com',      'Mon-Fri 9am-5pm',  'Doctor'),
('0792345678', 'pharma.joy@clinic.com',      'Mon-Fri 8am-4pm',  'Pharmacist'),
('0711112222', 'nurse.lee@clinic.com',       'Tue-Sat 9am-3pm',  'Nurse'),
('0723334444', 'reception.zulu@clinic.com',  'Mon-Fri 7am-5pm',  'Receptionist'),
('0735556666', 'admin.kim@clinic.com',       'Mon-Fri 8am-6pm',  'Admin');

-- Doctor
INSERT INTO Doctor (staff_id, specialization, license_number) VALUES
(1, 'General Practitioner', 'GP-2024-001');

-- Pharmacist
INSERT INTO Pharmacist (staff_id, license_number, specialization) VALUES
(2, 'PH123456', 'Dispensing');

-- Appointments
INSERT INTO Appointment (patient_id, doctor_id, datetime, consultation_notes, status) VALUES
(1, 1, '2025-05-15 10:00:00', 'Routine checkup',       'Completed'),
(2, 1, '2025-05-15 11:00:00', 'Blood pressure review',  'Scheduled'),
(3, 1, '2025-05-16 09:30:00', 'Asthma follow-up',       'Scheduled'),
(4, 1, '2025-05-16 10:30:00', 'Annual physical',         'Scheduled'),
(5, 1, '2025-05-17 14:00:00', 'Migraine consultation',   'Scheduled');

-- Medical Records
INSERT INTO Medical_Record (patient_id, doctor_id, lab_results, treatment_plan, diagnosis, consultation_notes) VALUES
(1, 1, 'Normal',      'Continue monitoring',       'Healthy',       'Routine checkup complete'),
(2, 1, 'Elevated BP', 'Prescribe beta-blockers',   'Hypertension',  'BP concerns discussed'),
(3, 1, 'Stable',      'Maintain inhaler use',      'Asthma',        'No new issues reported'),
(4, 1, 'Normal',      'No action needed',          'Healthy',       'Patient in good health'),
(5, 1, 'MRI required','Refer to neurologist',      'Migraine',      'Recurring headaches');

-- Prescriptions
INSERT INTO Prescription (record_id, medication, dosage, frequency, instructions, status, dispensed_at, last_updated_by) VALUES
(2, 'Atenolol',           '50mg',    'Once daily',  'Take after breakfast',   'Dispensed', '2025-05-15 12:00:00', 2),
(3, 'Salbutamol Inhaler', '2 puffs', 'Twice daily', 'Use when wheezing',      'Dispensed', '2025-05-16 10:00:00', 2),
(5, 'Ibuprofen',          '400mg',   'Twice daily', 'Take with food',         'Pending',   NULL,                   2),
(1, 'Multivitamin',       '1 tablet','Daily',        'General health support', 'Dispensed', '2025-05-15 11:00:00', 2),
(4, 'None',               'N/A',     'N/A',          'No medication needed',   'Not Required', NULL,               2);

-- Invoices
INSERT INTO Invoice (patient_id, total_amount, payment_method, payment_status, issued_by) VALUES
(1, 750.00, 'Credit Card', 'Paid',    5),
(2, 500.00, 'Cash',        'Unpaid',  5),
(3, 620.50, 'Medical Aid', 'Paid',    5),
(4, 430.00, 'Credit Card', 'Paid',    5),
(5, 999.99, 'Medical Aid', 'Pending', 5);

-- Inventory
INSERT INTO Inventory (name, stock_quant, reorder_level, unit_price, expiry_date, supplier_info) VALUES
('Paracetamol',           100,  20, 12.50,  '2026-12-31', '{"name":"HealthMed Suppliers"}'),
('Amoxicillin',            50,  10, 45.00,  '2025-10-01', '{"name":"PharmaLink"}'),
('Ibuprofen',             200,  30, 18.00,  '2026-01-15', '{"name":"MediCorp"}'),
('Bandages (box)',           0,  25,  8.00,  '2025-09-01', '{"name":"Global Meds"}'),
('Salbutamol Inhaler',     75,  15, 89.00,  '2026-06-20', '{"name":"CareLife Ltd"}');

-- User Accounts (passwords = "password123" hashed)
-- In production, use bcrypt. Hash below is bcrypt of "password123"
INSERT INTO UserAccount (staff_id, username, password_hash) VALUES
(1, 'dr.mokoena',     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewPqtlnOSixFXoNG'),
(2, 'pharma.joy',     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewPqtlnOSixFXoNG'),
(3, 'nurse.lee',      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewPqtlnOSixFXoNG'),
(4, 'recept.zulu',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewPqtlnOSixFXoNG'),
(5, 'admin.kim',      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewPqtlnOSixFXoNG');

-- Waitlist
INSERT INTO Waitlist (patient_id, doctor_id, requested_date, priority, status) VALUES
(2, 1, '2025-05-18', 5,  'Waiting'),
(4, 1, '2025-05-18', 3,  'Waiting'),
(5, 1, '2025-05-18', 7,  'Confirmed'),
(1, 1, '2025-05-18', 10, 'Cancelled'),
(3, 1, '2025-05-18', 4,  'Waiting');

-- Doctor Availability
INSERT INTO DoctorAvailability (doctor_id, available_date, start_time, end_time) VALUES
(1, '2025-05-15', '09:00', '17:00'),
(1, '2025-05-16', '09:00', '17:00'),
(1, '2025-05-17', '09:00', '17:00'),
(1, '2025-05-18', '09:00', '15:00'),
(1, '2025-05-19', '09:00', '17:00');

-- =============================================
-- AUDIT LOG TRIGGER (auto-log on changes)
-- =============================================
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO AuditLog (user_id, action_type, affected_table, record_id, new_values)
    VALUES (1, 'INSERT', TG_TABLE_NAME, NEW.*, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO AuditLog (user_id, action_type, affected_table, old_values, new_values)
    VALUES (1, 'UPDATE', TG_TABLE_NAME, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO AuditLog (user_id, action_type, affected_table, old_values)
    VALUES (1, 'DELETE', TG_TABLE_NAME, row_to_json(OLD));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SAMPLE QUERIES
-- =============================================
-- 1. All patients
-- SELECT first_name, surname, cell_no, email FROM Patient;

-- 2. Today's appointments
-- SELECT * FROM Appointment WHERE DATE(datetime) = CURRENT_DATE;

-- 3. Patient medical records
-- SELECT p.first_name, p.surname, m.* FROM Patient p JOIN Medical_Record m ON p.patient_id = m.patient_id WHERE p.patient_id = 1;

-- 4. Revenue summary
-- SELECT * FROM vw_financial_summary;

-- 5. Low stock alerts
-- SELECT * FROM vw_inventory_alerts;

-- 6. Doctor's upcoming schedule
-- SELECT * FROM vw_doctor_schedule;

-- 7. Unpaid invoices
-- SELECT Invoice_ID, Patient_ID, Total_Amount FROM Invoice WHERE Payment_Status = 'Unpaid';

-- 8. Patients above average invoice amount
-- SELECT First_Name, Surname FROM Patient WHERE Patient_ID IN (SELECT Patient_ID FROM Invoice WHERE Total_Amount > (SELECT AVG(Total_Amount) FROM Invoice));
