-- ============================================================
--   HIMALAYA HOSPITAL MANAGEMENT SYSTEM
--   Master Database Script — Complete Build
--
--   Author  : DBMS Semester Project
--   Hospital: Himalaya General Hospital, Kathmandu, Nepal (imaginary hospital)
--   Engine  : MySQL 8  (Railway)
--
--   CONTENTS
--   ════════════════════════════════════════════════════
--   PART 1 — DATABASE SETUP & CORE SCHEMA (v2)
--            1.1  Database creation
--            1.2  Auth & RBAC tables
--            1.3  Core entity tables
--            1.4  Room & bed management tables
--            1.5  Admissions table
--            1.6  Clinical tables
--            1.7  Inventory tables
--            1.8  Billing tables
--            1.9  Views  (6 views)
--            1.10 Stored procedures  (5 procedures)
--            1.11 Triggers  (4 triggers)
--
--   PART 2 — ADMISSION FEATURES PATCH
--            2.1  visit_type column on admissions
--            2.2  Waiting list table
--            2.3  Transfer log table
--            2.4  Views  (2 new views)
--            2.5  Stored procedures  (4 new / updated)
--            2.6  Trigger  (1 new trigger)
--
--   PART 3 — SEED DATA
--            3.1  Roles & permissions
--            3.2  Departments & users
--            3.3  Doctors & staff
--            3.4  Patients  (20 patients)
--            3.5  Rooms, beds & room types
--            3.6  Medicines & stock
--            3.7  Lab tests
--            3.8  Appointments  (30)
--            3.9  Medical records  (17)
--            3.10 Prescriptions & items
--            3.11 Lab results  (16)
--            3.12 Admissions  (11)
--            3.13 Waiting list
--            3.14 Bills, bill items & payments
--            3.15 Final row-count check
--
--   HOW TO RUN
--   ════════════════════════════════════════════════════
--   Run this entire file once against a fresh MySQL
--   instance. It is safe to re-run — the seed section
--   starts with TRUNCATE on all tables.
--
--   MySQL Workbench:
--     Open file → Run All (Ctrl+Shift+Enter)
--
--   mysql CLI:
--     mysql -h HOST -P PORT -u USER -p < hospital_master.sql
-- ============================================================



-- ════════════════════════════════════════════════════════════
-- ████  PART 1 — DATABASE SETUP & CORE SCHEMA  ████████████
-- ════════════════════════════════════════════════════════════

-- ============================================================
--   HOSPITAL MANAGEMENT SYSTEM — MySQL Schema v2.0
--   Features:
--     - Full RBAC (roles + permissions)
--     - Patient admission / discharge
--     - Room & bed management
--     - Doctor availability schedule (simple per-day)
--     - Core clinical + billing tables (clean rewrite)
-- ============================================================

CREATE DATABASE IF NOT EXISTS hospital_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE hospital_db;

SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
-- SECTION 1 — AUTH & RBAC
-- ============================================================

-- 1.1  Roles  (e.g. 'admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_technician')
CREATE TABLE roles (
    role_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(255)
);

-- 1.2  Permissions  (e.g. 'manage_users', 'view_records', 'edit_billing')
CREATE TABLE permissions (
    permission_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,   -- e.g. 'billing.create'
    description     VARCHAR(255)
);

-- 1.3  Role ↔ Permission  (many-to-many)
CREATE TABLE role_permissions (
    role_id         INT UNSIGNED NOT NULL,
    permission_id   INT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_rp_role
        FOREIGN KEY (role_id) REFERENCES roles(role_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rp_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(permission_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 1.4  Users  (single table; linked to doctors/staff via nullable FKs added later)
CREATE TABLE users (
    user_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(120) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,          -- bcrypt / argon2 hash
    role_id         INT UNSIGNED NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login      DATETIME     DEFAULT NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_role
        FOREIGN KEY (role_id) REFERENCES roles(role_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    INDEX idx_user_email (email)
);


-- ============================================================
-- SECTION 2 — CORE ENTITIES
-- ============================================================

-- 2.1  Departments
CREATE TABLE departments (
    department_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    location        VARCHAR(100),
    head_doctor_id  INT UNSIGNED DEFAULT NULL,      -- FK added after doctors
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.2  Doctors
CREATE TABLE doctors (
    doctor_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL UNIQUE,   -- auth account
    first_name          VARCHAR(60)  NOT NULL,
    last_name           VARCHAR(60)  NOT NULL,
    phone               VARCHAR(20),
    specialization      VARCHAR(100),
    department_id       INT UNSIGNED,
    license_number      VARCHAR(50)  NOT NULL UNIQUE,
    consultation_fee    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    -- Simple daily availability
    available_days      SET('Mon','Tue','Wed','Thu','Fri','Sat','Sun') DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    available_from      TIME         DEFAULT '09:00:00',
    available_to        TIME         DEFAULT '17:00:00',
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    joined_date         DATE,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_doctor_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_doctor_dept
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_doctor_name (last_name, first_name)
);

-- Deferred FK: department head
ALTER TABLE departments
    ADD CONSTRAINT fk_dept_head
        FOREIGN KEY (head_doctor_id) REFERENCES doctors(doctor_id)
        ON DELETE SET NULL ON UPDATE CASCADE;

-- 2.3  Staff  (nurses, receptionists, pharmacists, lab techs, admin)
CREATE TABLE staff (
    staff_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED NOT NULL UNIQUE,
    first_name      VARCHAR(60)  NOT NULL,
    last_name       VARCHAR(60)  NOT NULL,
    phone           VARCHAR(20),
    job_title       VARCHAR(100),
    department_id   INT UNSIGNED,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    joined_date     DATE,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_staff_user
        FOREIGN KEY (user_id) REFERENCES users(user_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_staff_dept
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- 2.4  Patients
CREATE TABLE patients (
    patient_id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name              VARCHAR(60)  NOT NULL,
    last_name               VARCHAR(60)  NOT NULL,
    date_of_birth           DATE         NOT NULL,
    gender                  ENUM('Male','Female','Other') NOT NULL,
    blood_group             ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') DEFAULT NULL,
    email                   VARCHAR(120) UNIQUE,
    phone                   VARCHAR(20)  NOT NULL,
    address                 TEXT,
    emergency_contact_name  VARCHAR(120),
    emergency_contact_phone VARCHAR(20),
    allergies               TEXT,
    created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_patient_name  (last_name, first_name),
    INDEX idx_patient_phone (phone)
);


-- ============================================================
-- SECTION 3 — ROOM & BED MANAGEMENT
-- ============================================================

-- 3.1  Room types  (e.g. General Ward, ICU, Private, Semi-Private, OT)
CREATE TABLE room_types (
    room_type_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(80)   NOT NULL UNIQUE,
    description     VARCHAR(255),
    daily_rate      DECIMAL(10,2) NOT NULL DEFAULT 0.00
);

-- 3.2  Rooms
CREATE TABLE rooms (
    room_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_number     VARCHAR(20)   NOT NULL UNIQUE,
    room_type_id    INT UNSIGNED  NOT NULL,
    department_id   INT UNSIGNED,
    floor           TINYINT UNSIGNED,
    total_beds      TINYINT UNSIGNED NOT NULL DEFAULT 1,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    notes           VARCHAR(255),

    CONSTRAINT fk_room_type
        FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_room_dept
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3.3  Beds
CREATE TABLE beds (
    bed_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id         INT UNSIGNED NOT NULL,
    bed_number      VARCHAR(10)  NOT NULL,          -- e.g. 'A', 'B', '1', '2'
    status          ENUM('Available','Occupied','Under Maintenance') NOT NULL DEFAULT 'Available',

    CONSTRAINT fk_bed_room
        FOREIGN KEY (room_id) REFERENCES rooms(room_id)
        ON DELETE CASCADE ON UPDATE CASCADE,

    UNIQUE KEY uq_bed (room_id, bed_number)
);


-- ============================================================
-- SECTION 4 — ADMISSIONS
-- ============================================================

-- 4.1  Admissions  (inpatient stays)
CREATE TABLE admissions (
    admission_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id          INT UNSIGNED NOT NULL,
    bed_id              INT UNSIGNED NOT NULL,
    admitting_doctor_id INT UNSIGNED NOT NULL,
    admitted_by         INT UNSIGNED,               -- staff_id (receptionist)
    admission_date      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_discharge  DATE,
    actual_discharge    DATETIME     DEFAULT NULL,
    admission_reason    TEXT,
    discharge_summary   TEXT,
    status              ENUM('Active','Discharged','Transferred','Absconded') NOT NULL DEFAULT 'Active',
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_adm_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_adm_bed
        FOREIGN KEY (bed_id) REFERENCES beds(bed_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_adm_doctor
        FOREIGN KEY (admitting_doctor_id) REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_adm_staff
        FOREIGN KEY (admitted_by) REFERENCES staff(staff_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_adm_patient (patient_id),
    INDEX idx_adm_status  (status),
    INDEX idx_adm_date    (admission_date)
);


-- ============================================================
-- SECTION 5 — CLINICAL TABLES
-- ============================================================

-- 5.1  Appointments
CREATE TABLE appointments (
    appointment_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id          INT UNSIGNED NOT NULL,
    doctor_id           INT UNSIGNED NOT NULL,
    appointment_date    DATE         NOT NULL,
    appointment_time    TIME         NOT NULL,
    reason              VARCHAR(255),
    status              ENUM('Scheduled','Confirmed','Completed','Cancelled','No-Show') NOT NULL DEFAULT 'Scheduled',
    notes               TEXT,
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_appt_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_appt_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    -- Prevents double-booking same doctor at same slot
    UNIQUE KEY uq_doctor_slot (doctor_id, appointment_date, appointment_time),

    INDEX idx_appt_date    (appointment_date),
    INDEX idx_appt_patient (patient_id),
    INDEX idx_appt_doctor  (doctor_id)
);

-- 5.2  Medical Records
CREATE TABLE medical_records (
    record_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id      INT UNSIGNED NOT NULL,
    doctor_id       INT UNSIGNED NOT NULL,
    appointment_id  INT UNSIGNED DEFAULT NULL,
    admission_id    INT UNSIGNED DEFAULT NULL,      -- set for inpatient records
    visit_date      DATE         NOT NULL,
    chief_complaint TEXT,
    diagnosis       TEXT,
    treatment_plan  TEXT,
    -- Vitals
    blood_pressure  VARCHAR(20),                    -- e.g. '120/80'
    heart_rate      SMALLINT UNSIGNED,              -- bpm
    temperature     DECIMAL(4,1),                   -- Celsius
    weight_kg       DECIMAL(5,2),
    height_cm       DECIMAL(5,2),
    oxygen_sat      TINYINT UNSIGNED,               -- SpO2 %
    notes           TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_rec_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rec_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_rec_appt
        FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_rec_admission
        FOREIGN KEY (admission_id) REFERENCES admissions(admission_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_rec_patient (patient_id),
    INDEX idx_rec_visit   (visit_date)
);

-- 5.3  Prescriptions (header)
CREATE TABLE prescriptions (
    prescription_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    record_id       INT UNSIGNED NOT NULL,
    patient_id      INT UNSIGNED NOT NULL,
    doctor_id       INT UNSIGNED NOT NULL,
    prescribed_date DATE         NOT NULL,
    valid_till      DATE,
    notes           TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_presc_record
        FOREIGN KEY (record_id) REFERENCES medical_records(record_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_presc_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_presc_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5.4  Prescription Items
CREATE TABLE prescription_items (
    item_id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prescription_id     INT UNSIGNED NOT NULL,
    medicine_id         INT UNSIGNED NOT NULL,
    dosage              VARCHAR(50),                -- e.g. '500mg'
    frequency           VARCHAR(50),                -- e.g. 'Twice daily'
    duration_days       TINYINT UNSIGNED,
    quantity            SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    instructions        VARCHAR(255),               -- e.g. 'Take after meals'

    CONSTRAINT fk_pi_prescription
        FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_pi_medicine
        FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 5.5  Lab Tests (catalog)
CREATE TABLE lab_tests (
    test_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    test_name       VARCHAR(150) NOT NULL,
    category        VARCHAR(100),                   -- e.g. 'Haematology'
    normal_range    VARCHAR(100),
    unit            VARCHAR(30),
    base_price      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE
);

-- 5.6  Lab Results
CREATE TABLE lab_results (
    result_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id      INT UNSIGNED NOT NULL,
    record_id       INT UNSIGNED DEFAULT NULL,
    test_id         INT UNSIGNED NOT NULL,
    ordered_by      INT UNSIGNED NOT NULL,          -- doctor_id
    ordered_date    DATE         NOT NULL,
    result_date     DATE         DEFAULT NULL,
    result_value    VARCHAR(200),
    status          ENUM('Ordered','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Ordered',
    remarks         TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_lr_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_lr_record
        FOREIGN KEY (record_id) REFERENCES medical_records(record_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_lr_test
        FOREIGN KEY (test_id) REFERENCES lab_tests(test_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_lr_doctor
        FOREIGN KEY (ordered_by) REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    INDEX idx_lr_patient (patient_id),
    INDEX idx_lr_date    (ordered_date)
);


-- ============================================================
-- SECTION 6 — INVENTORY
-- ============================================================

-- 6.1  Medicines
CREATE TABLE medicines (
    medicine_id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                    VARCHAR(150) NOT NULL,
    generic_name            VARCHAR(150),
    category                VARCHAR(100),           -- e.g. 'Antibiotic'
    manufacturer            VARCHAR(150),
    unit_price              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    requires_prescription   BOOLEAN       NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_med_name (name)
);

-- 6.2  Medicine Stock
CREATE TABLE medicine_stock (
    stock_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    medicine_id     INT UNSIGNED NOT NULL UNIQUE,
    quantity        INT UNSIGNED NOT NULL DEFAULT 0,
    reorder_level   INT UNSIGNED NOT NULL DEFAULT 50,
    expiry_date     DATE,
    last_updated    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_stock_medicine
        FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- ============================================================
-- SECTION 7 — BILLING
-- ============================================================

-- 7.1  Bills (header)
CREATE TABLE bills (
    bill_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id      INT UNSIGNED NOT NULL,
    appointment_id  INT UNSIGNED DEFAULT NULL,
    admission_id    INT UNSIGNED DEFAULT NULL,
    bill_date       DATE         NOT NULL,
    due_date        DATE,
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_pct    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
    tax_pct         DECIMAL(5,2)  NOT NULL DEFAULT 13.00, -- Nepal VAT
    total_amount    DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount_paid     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    status          ENUM('Draft','Issued','Partially Paid','Paid','Cancelled') NOT NULL DEFAULT 'Draft',
    notes           TEXT,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_bill_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_bill_appt
        FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_bill_admission
        FOREIGN KEY (admission_id) REFERENCES admissions(admission_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_bill_patient (patient_id),
    INDEX idx_bill_date    (bill_date)
);

-- 7.2  Bill Items (line items)
CREATE TABLE bill_items (
    bill_item_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bill_id         INT UNSIGNED NOT NULL,
    item_type       ENUM('Consultation','Lab Test','Medicine','Procedure','Room','Other') NOT NULL,
    description     VARCHAR(255) NOT NULL,
    quantity        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10,2) NOT NULL,
    line_total      DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    CONSTRAINT fk_bi_bill
        FOREIGN KEY (bill_id) REFERENCES bills(bill_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7.3  Payments
CREATE TABLE payments (
    payment_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bill_id         INT UNSIGNED NOT NULL,
    payment_date    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount          DECIMAL(12,2) NOT NULL,
    method          ENUM('Cash','Card','Bank Transfer','Mobile Payment','Insurance') NOT NULL,
    reference_no    VARCHAR(100),
    received_by     INT UNSIGNED DEFAULT NULL,      -- staff_id
    notes           TEXT,

    CONSTRAINT fk_pay_bill
        FOREIGN KEY (bill_id) REFERENCES bills(bill_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_pay_staff
        FOREIGN KEY (received_by) REFERENCES staff(staff_id)
        ON DELETE SET NULL ON UPDATE CASCADE,

    INDEX idx_pay_bill (bill_id),
    INDEX idx_pay_date (payment_date)
);

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- SECTION 8 — VIEWS
-- ============================================================

-- 8.1  Today's appointment schedule
CREATE OR REPLACE VIEW vw_todays_appointments AS
SELECT
    a.appointment_id,
    a.appointment_time,
    CONCAT(p.first_name, ' ', p.last_name)  AS patient_name,
    p.phone                                   AS patient_phone,
    CONCAT(d.first_name, ' ', d.last_name)   AS doctor_name,
    d.specialization,
    dep.name                                  AS department,
    a.reason,
    a.status
FROM appointments a
JOIN patients     p   ON a.patient_id    = p.patient_id
JOIN doctors      d   ON a.doctor_id     = d.doctor_id
LEFT JOIN departments dep ON d.department_id = dep.department_id
WHERE a.appointment_date = CURDATE()
ORDER BY a.appointment_time;

-- 8.2  Current bed occupancy
CREATE OR REPLACE VIEW vw_bed_occupancy AS
SELECT
    r.room_number,
    rt.name                                         AS room_type,
    dep.name                                        AS department,
    r.floor,
    b.bed_id,
    b.bed_number,
    b.status                                        AS bed_status,
    CONCAT(p.first_name, ' ', p.last_name)          AS current_patient,
    adm.admission_date,
    adm.expected_discharge,
    CONCAT(doc.first_name, ' ', doc.last_name)      AS admitting_doctor
FROM beds b
JOIN rooms        r   ON b.room_id         = r.room_id
JOIN room_types   rt  ON r.room_type_id    = rt.room_type_id
LEFT JOIN departments dep ON r.department_id = dep.department_id
LEFT JOIN admissions adm ON b.bed_id = adm.bed_id AND adm.status = 'Active'
LEFT JOIN patients   p   ON adm.patient_id   = p.patient_id
LEFT JOIN doctors    doc ON adm.admitting_doctor_id = doc.doctor_id
ORDER BY r.room_number, b.bed_number;

-- 8.3  Outstanding bills
CREATE OR REPLACE VIEW vw_outstanding_bills AS
SELECT
    b.bill_id,
    CONCAT(p.first_name, ' ', p.last_name)  AS patient_name,
    p.phone,
    b.bill_date,
    b.due_date,
    b.total_amount,
    b.amount_paid,
    (b.total_amount - b.amount_paid)         AS balance_due,
    b.status,
    DATEDIFF(CURDATE(), b.due_date)          AS days_overdue
FROM bills b
JOIN patients p ON b.patient_id = p.patient_id
WHERE b.status IN ('Issued', 'Partially Paid')
ORDER BY days_overdue DESC;

-- 8.4  Patient summary
CREATE OR REPLACE VIEW vw_patient_summary AS
SELECT
    p.patient_id,
    CONCAT(p.first_name, ' ', p.last_name)  AS full_name,
    p.date_of_birth,
    TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
    p.gender,
    p.blood_group,
    p.phone,
    p.allergies,
    COUNT(DISTINCT a.appointment_id)         AS total_appointments,
    COUNT(DISTINCT adm.admission_id)         AS total_admissions,
    MAX(a.appointment_date)                  AS last_appointment
FROM patients p
LEFT JOIN appointments a   ON p.patient_id = a.patient_id
LEFT JOIN admissions   adm ON p.patient_id = adm.patient_id
GROUP BY p.patient_id;

-- 8.5  Low medicine stock alert
CREATE OR REPLACE VIEW vw_low_stock AS
SELECT
    m.medicine_id,
    m.name          AS medicine_name,
    m.category,
    s.quantity      AS current_stock,
    s.reorder_level,
    s.expiry_date,
    CASE
        WHEN s.quantity = 0              THEN 'OUT OF STOCK'
        WHEN s.quantity <= s.reorder_level THEN 'LOW STOCK'
        ELSE 'OK'
    END             AS stock_status
FROM medicines m
JOIN medicine_stock s ON m.medicine_id = s.medicine_id
WHERE s.quantity <= s.reorder_level
ORDER BY s.quantity ASC;

-- 8.6  Doctor revenue
CREATE OR REPLACE VIEW vw_doctor_revenue AS
SELECT
    d.doctor_id,
    CONCAT(d.first_name, ' ', d.last_name)  AS doctor_name,
    d.specialization,
    dep.name                                  AS department,
    COUNT(DISTINCT a.appointment_id)          AS completed_appointments,
    COALESCE(SUM(bi.line_total), 0)           AS total_revenue
FROM doctors d
LEFT JOIN departments  dep ON d.department_id  = dep.department_id
LEFT JOIN appointments a   ON d.doctor_id      = a.doctor_id AND a.status = 'Completed'
LEFT JOIN bills        b   ON a.appointment_id = b.appointment_id
LEFT JOIN bill_items   bi  ON b.bill_id        = bi.bill_id AND bi.item_type = 'Consultation'
GROUP BY d.doctor_id
ORDER BY total_revenue DESC;


-- ============================================================
-- SECTION 9 — STORED PROCEDURES
-- ============================================================

DELIMITER $$

-- 9.1  Book an appointment
CREATE PROCEDURE sp_book_appointment (
    IN  p_patient_id     INT UNSIGNED,
    IN  p_doctor_id      INT UNSIGNED,
    IN  p_date           DATE,
    IN  p_time           TIME,
    IN  p_reason         VARCHAR(255),
    OUT p_appointment_id INT UNSIGNED,
    OUT p_message        VARCHAR(200)
)
BEGIN
    DECLARE v_conflict  INT     DEFAULT 0;
    DECLARE v_active    BOOLEAN DEFAULT NULL;

    SELECT is_active INTO v_active FROM doctors WHERE doctor_id = p_doctor_id;

    IF v_active IS NULL THEN
        SET p_appointment_id = 0;
        SET p_message = 'Error: Doctor not found.';
    ELSEIF v_active = FALSE THEN
        SET p_appointment_id = 0;
        SET p_message = 'Error: Doctor is not currently active.';
    ELSE
        SELECT COUNT(*) INTO v_conflict
        FROM appointments
        WHERE doctor_id        = p_doctor_id
          AND appointment_date = p_date
          AND appointment_time = p_time
          AND status NOT IN ('Cancelled', 'No-Show');

        IF v_conflict > 0 THEN
            SET p_appointment_id = 0;
            SET p_message = 'Error: This time slot is already booked.';
        ELSE
            INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason)
            VALUES (p_patient_id, p_doctor_id, p_date, p_time, p_reason);

            SET p_appointment_id = LAST_INSERT_ID();
            SET p_message = CONCAT('Success: Appointment #', p_appointment_id, ' booked.');
        END IF;
    END IF;
END$$

-- 9.2  Admit a patient (marks bed Occupied)
CREATE PROCEDURE sp_admit_patient (
    IN  p_patient_id    INT UNSIGNED,
    IN  p_bed_id        INT UNSIGNED,
    IN  p_doctor_id     INT UNSIGNED,
    IN  p_staff_id      INT UNSIGNED,
    IN  p_reason        TEXT,
    IN  p_exp_discharge DATE,
    OUT p_admission_id  INT UNSIGNED,
    OUT p_message       VARCHAR(200)
)
BEGIN
    DECLARE v_bed_status VARCHAR(30);

    SELECT status INTO v_bed_status FROM beds WHERE bed_id = p_bed_id;

    IF v_bed_status IS NULL THEN
        SET p_admission_id = 0;
        SET p_message = 'Error: Bed not found.';
    ELSEIF v_bed_status != 'Available' THEN
        SET p_admission_id = 0;
        SET p_message = CONCAT('Error: Bed is currently ', v_bed_status, '.');
    ELSE
        INSERT INTO admissions
            (patient_id, bed_id, admitting_doctor_id, admitted_by, admission_reason, expected_discharge)
        VALUES
            (p_patient_id, p_bed_id, p_doctor_id, p_staff_id, p_reason, p_exp_discharge);

        SET p_admission_id = LAST_INSERT_ID();

        UPDATE beds SET status = 'Occupied' WHERE bed_id = p_bed_id;

        SET p_message = CONCAT('Success: Patient admitted. Admission #', p_admission_id, '.');
    END IF;
END$$

-- 9.3  Discharge a patient (frees the bed)
CREATE PROCEDURE sp_discharge_patient (
    IN  p_admission_id  INT UNSIGNED,
    IN  p_summary       TEXT,
    OUT p_message       VARCHAR(200)
)
BEGIN
    DECLARE v_bed_id INT UNSIGNED;
    DECLARE v_status VARCHAR(20);

    SELECT bed_id, status INTO v_bed_id, v_status
    FROM admissions WHERE admission_id = p_admission_id;

    IF v_bed_id IS NULL THEN
        SET p_message = 'Error: Admission not found.';
    ELSEIF v_status != 'Active' THEN
        SET p_message = CONCAT('Error: Admission is already ', v_status, '.');
    ELSE
        UPDATE admissions
        SET status           = 'Discharged',
            actual_discharge = NOW(),
            discharge_summary = p_summary
        WHERE admission_id = p_admission_id;

        UPDATE beds SET status = 'Available' WHERE bed_id = v_bed_id;

        SET p_message = CONCAT('Success: Patient discharged. Bed ', v_bed_id, ' is now available.');
    END IF;
END$$

-- 9.4  Generate bill for an appointment or admission
CREATE PROCEDURE sp_generate_bill (
    IN  p_patient_id     INT UNSIGNED,
    IN  p_appointment_id INT UNSIGNED,   -- pass NULL for admission-only bills
    IN  p_admission_id   INT UNSIGNED,   -- pass NULL for outpatient bills
    IN  p_discount_pct   DECIMAL(5,2),
    OUT p_bill_id        INT UNSIGNED,
    OUT p_total          DECIMAL(12,2)
)
BEGIN
    DECLARE v_consult_fee DECIMAL(10,2) DEFAULT 0.00;
    DECLARE v_tax         DECIMAL(5,2)  DEFAULT 13.00;
    DECLARE v_subtotal    DECIMAL(12,2);

    -- Consultation fee (outpatient)
    IF p_appointment_id IS NOT NULL THEN
        SELECT d.consultation_fee INTO v_consult_fee
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.doctor_id
        WHERE a.appointment_id = p_appointment_id;
    END IF;

    INSERT INTO bills (patient_id, appointment_id, admission_id, bill_date,
                       due_date, discount_pct, tax_pct, status)
    VALUES (p_patient_id, p_appointment_id, p_admission_id, CURDATE(),
            DATE_ADD(CURDATE(), INTERVAL 30 DAY), p_discount_pct, v_tax, 'Draft');

    SET p_bill_id = LAST_INSERT_ID();

    -- Consultation line item
    IF v_consult_fee > 0 THEN
        INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price)
        VALUES (p_bill_id, 'Consultation', 'Doctor consultation fee', 1, v_consult_fee);
    END IF;

    -- Lab tests linked to this appointment's medical record
    IF p_appointment_id IS NOT NULL THEN
        INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price)
        SELECT p_bill_id, 'Lab Test', lt.test_name, 1, lt.base_price
        FROM lab_results lr
        JOIN lab_tests   lt ON lr.test_id  = lt.test_id
        JOIN medical_records mr ON lr.record_id = mr.record_id
        WHERE mr.appointment_id = p_appointment_id
          AND lr.status != 'Cancelled';
    END IF;

    -- Room charges for admission
    IF p_admission_id IS NOT NULL THEN
        INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price)
        SELECT
            p_bill_id,
            'Room',
            CONCAT(rt.name, ' — ', r.room_number, ' Bed ', b.bed_number),
            GREATEST(DATEDIFF(COALESCE(adm.actual_discharge, NOW()), adm.admission_date), 1),
            rt.daily_rate
        FROM admissions adm
        JOIN beds       b  ON adm.bed_id      = b.bed_id
        JOIN rooms      r  ON b.room_id       = r.room_id
        JOIN room_types rt ON r.room_type_id  = rt.room_type_id
        WHERE adm.admission_id = p_admission_id;
    END IF;

    -- Compute totals
    SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM bill_items WHERE bill_id = p_bill_id;

    UPDATE bills
    SET subtotal     = v_subtotal,
        total_amount = v_subtotal * (1 - p_discount_pct / 100) * (1 + v_tax / 100),
        status       = 'Issued'
    WHERE bill_id = p_bill_id;

    SELECT total_amount INTO p_total FROM bills WHERE bill_id = p_bill_id;
END$$

-- 9.5  Record a payment and update bill status
CREATE PROCEDURE sp_record_payment (
    IN  p_bill_id    INT UNSIGNED,
    IN  p_amount     DECIMAL(12,2),
    IN  p_method     VARCHAR(50),
    IN  p_reference  VARCHAR(100),
    IN  p_staff_id   INT UNSIGNED,
    OUT p_status     VARCHAR(50),
    OUT p_balance    DECIMAL(12,2)
)
BEGIN
    DECLARE v_total    DECIMAL(12,2);
    DECLARE v_paid     DECIMAL(12,2);
    DECLARE v_new_paid DECIMAL(12,2);

    SELECT total_amount, amount_paid INTO v_total, v_paid
    FROM bills WHERE bill_id = p_bill_id;

    SET v_new_paid = v_paid + p_amount;

    INSERT INTO payments (bill_id, amount, method, reference_no, received_by)
    VALUES (p_bill_id, p_amount, p_method, p_reference, p_staff_id);

    IF v_new_paid >= v_total THEN
        SET p_status = 'Paid';
    ELSEIF v_new_paid > 0 THEN
        SET p_status = 'Partially Paid';
    ELSE
        SET p_status = 'Issued';
    END IF;

    UPDATE bills SET amount_paid = v_new_paid, status = p_status
    WHERE bill_id = p_bill_id;

    SET p_balance = GREATEST(v_total - v_new_paid, 0);
END$$

-- 9.6  Full patient history (5 result sets)
CREATE PROCEDURE sp_patient_history (IN p_patient_id INT UNSIGNED)
BEGIN
    SELECT patient_id,
           CONCAT(first_name,' ',last_name) AS full_name,
           date_of_birth,
           TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) AS age,
           gender, blood_group, phone, allergies
    FROM patients WHERE patient_id = p_patient_id;

    SELECT a.appointment_id, a.appointment_date, a.appointment_time,
           CONCAT(d.first_name,' ',d.last_name) AS doctor,
           d.specialization, a.reason, a.status
    FROM appointments a JOIN doctors d ON a.doctor_id = d.doctor_id
    WHERE a.patient_id = p_patient_id ORDER BY a.appointment_date DESC;

    SELECT adm.admission_id, adm.admission_date, adm.actual_discharge,
           CONCAT(d.first_name,' ',d.last_name) AS doctor,
           rt.name AS room_type, r.room_number, b.bed_number,
           adm.admission_reason, adm.discharge_summary, adm.status
    FROM admissions adm
    JOIN doctors    d  ON adm.admitting_doctor_id = d.doctor_id
    JOIN beds       b  ON adm.bed_id = b.bed_id
    JOIN rooms      r  ON b.room_id  = r.room_id
    JOIN room_types rt ON r.room_type_id = rt.room_type_id
    WHERE adm.patient_id = p_patient_id ORDER BY adm.admission_date DESC;

    SELECT mr.record_id, mr.visit_date,
           CONCAT(d.first_name,' ',d.last_name) AS doctor,
           mr.chief_complaint, mr.diagnosis, mr.treatment_plan,
           mr.blood_pressure, mr.heart_rate, mr.temperature, mr.weight_kg, mr.oxygen_sat
    FROM medical_records mr JOIN doctors d ON mr.doctor_id = d.doctor_id
    WHERE mr.patient_id = p_patient_id ORDER BY mr.visit_date DESC;

    SELECT lr.result_id, lt.test_name, lt.category,
           lr.ordered_date, lr.result_date, lr.result_value,
           lt.normal_range, lt.unit, lr.status, lr.remarks
    FROM lab_results lr JOIN lab_tests lt ON lr.test_id = lt.test_id
    WHERE lr.patient_id = p_patient_id ORDER BY lr.ordered_date DESC;
END$$

DELIMITER ;


-- ============================================================
-- SECTION 10 — TRIGGERS
-- ============================================================

DELIMITER $$

-- 10.1  Prevent booking appointments in the past
CREATE TRIGGER trg_no_past_appointments
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    IF NEW.appointment_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot book an appointment in the past.';
    END IF;
END$$

-- 10.2  Mark appointment Completed when a medical record is created for it
CREATE TRIGGER trg_complete_appointment
AFTER INSERT ON medical_records
FOR EACH ROW
BEGIN
    IF NEW.appointment_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'Completed'
        WHERE appointment_id = NEW.appointment_id;
    END IF;
END$$

-- 10.3  Auto-deduct medicine stock on prescription
CREATE TRIGGER trg_deduct_stock
AFTER INSERT ON prescription_items
FOR EACH ROW
BEGIN
    UPDATE medicine_stock
    SET quantity = GREATEST(quantity - NEW.quantity, 0)
    WHERE medicine_id = NEW.medicine_id;
END$$

-- 10.4  Update bill status to Paid when full payment is received
CREATE TRIGGER trg_payment_status
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE v_total DECIMAL(12,2);
    DECLARE v_paid  DECIMAL(12,2);

    SELECT total_amount, amount_paid INTO v_total, v_paid
    FROM bills WHERE bill_id = NEW.bill_id;

    IF v_paid >= v_total THEN
        UPDATE bills SET status = 'Paid' WHERE bill_id = NEW.bill_id;
    END IF;
END$$

-- 10.5  Prevent admitting to an occupied / maintenance bed
CREATE TRIGGER trg_check_bed_on_admit
BEFORE INSERT ON admissions
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(30);
    SELECT status INTO v_status FROM beds WHERE bed_id = NEW.bed_id;
    IF v_status != 'Available' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Bed is not available for admission.';
    END IF;
END$$

DELIMITER ;


-- ============================================================
-- SECTION 11 — SEED DATA
-- ============================================================

-- Roles
INSERT INTO roles (name, description) VALUES
('admin',           'Full system access'),
('doctor',          'Clinical records, appointments, prescriptions'),
('nurse',           'View records, update vitals'),
('receptionist',    'Appointments, admissions, billing'),
('pharmacist',      'Medicines and stock management'),
('lab_technician',  'Lab tests and results');

-- Permissions
INSERT INTO permissions (name, description) VALUES
('users.manage',        'Create / edit / deactivate users'),
('records.view',        'View patient medical records'),
('records.edit',        'Create and update medical records'),
('appointments.manage', 'Book, reschedule, cancel appointments'),
('billing.create',      'Generate bills'),
('billing.payment',     'Record payments'),
('pharmacy.manage',     'Manage medicines and stock'),
('lab.manage',          'Order and update lab results'),
('admissions.manage',   'Admit and discharge patients'),
('reports.view',        'View revenue and summary reports');

-- Role → Permission mapping
INSERT INTO role_permissions (role_id, permission_id) VALUES
-- admin gets everything
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),
-- doctor
(2,2),(2,3),(2,4),(2,8),
-- nurse
(3,2),(3,3),
-- receptionist
(4,2),(4,4),(4,5),(4,6),(4,9),
-- pharmacist
(5,2),(5,7),
-- lab technician
(6,2),(6,8);

-- Departments
INSERT INTO departments (name, description, location) VALUES
('General Medicine',  'Primary care and internal medicine', 'Block A, Floor 1'),
('Cardiology',        'Heart and cardiovascular care',       'Block B, Floor 2'),
('Orthopaedics',      'Bone and joint care',                 'Block A, Floor 2'),
('Pathology & Lab',   'Diagnostic laboratory services',      'Block C, Ground'),
('Pharmacy',          'Medicine dispensing',                 'Block A, Ground'),
('ICU',               'Intensive care unit',                 'Block B, Floor 3');

-- Users (passwords are placeholder hashes — replace with real bcrypt hashes)
INSERT INTO users (email, password_hash, role_id) VALUES
('admin@hospital.np',         '$2b$12$placeholderhashadmin',    1),
('ramesh.sharma@hospital.np', '$2b$12$placeholderhashdoctor1',  2),
('sunita.thapa@hospital.np',  '$2b$12$placeholderhashdoctor2',  2),
('bikash.acharya@hospital.np','$2b$12$placeholderhashdoctor3',  2),
('anita.gurung@hospital.np',  '$2b$12$placeholderhashstaff1',   4),
('roshan.basnet@hospital.np', '$2b$12$placeholderhashstaff2',   5),
('kamala.kc@hospital.np',     '$2b$12$placeholderhashstaff3',   3);

-- Doctors
INSERT INTO doctors (user_id, first_name, last_name, phone, specialization, department_id, license_number, consultation_fee, available_days, available_from, available_to, joined_date) VALUES
(2, 'Ramesh',  'Sharma',  '9841000001', 'General Physician',   1, 'NMC-001', 500.00,  'Mon,Tue,Wed,Thu,Fri', '09:00:00', '17:00:00', '2018-03-01'),
(3, 'Sunita',  'Thapa',   '9841000002', 'Cardiologist',        2, 'NMC-002', 1500.00, 'Mon,Tue,Wed,Thu,Fri', '10:00:00', '16:00:00', '2019-07-15'),
(4, 'Bikash',  'Acharya', '9841000003', 'Orthopaedic Surgeon', 3, 'NMC-003', 1200.00, 'Mon,Wed,Fri',         '09:00:00', '14:00:00', '2020-01-10');

-- Department heads
UPDATE departments SET head_doctor_id = 1 WHERE department_id = 1;
UPDATE departments SET head_doctor_id = 2 WHERE department_id = 2;
UPDATE departments SET head_doctor_id = 3 WHERE department_id = 3;

-- Staff
INSERT INTO staff (user_id, first_name, last_name, phone, job_title, department_id, joined_date) VALUES
(5, 'Anita',  'Gurung', '9841000010', 'Receptionist', 1, '2021-01-05'),
(6, 'Roshan', 'Basnet', '9841000011', 'Pharmacist',   5, '2020-09-01'),
(7, 'Kamala', 'KC',     '9841000012', 'Nurse',        1, '2022-03-15');

-- Patients
INSERT INTO patients (first_name, last_name, date_of_birth, gender, blood_group, email, phone, address, allergies) VALUES
('Aarav',  'Pandey',   '1990-05-12', 'Male',   'B+',  'aarav.pandey@gmail.com', '9851000001', 'Kathmandu, Baneshwor',    'Penicillin'),
('Priya',  'Shrestha', '1985-11-23', 'Female', 'O+',  'priya.shr@gmail.com',    '9851000002', 'Lalitpur, Pulchowk',      NULL),
('Sanjay', 'Joshi',    '1972-07-30', 'Male',   'A-',  'sanjay.joshi@gmail.com', '9851000003', 'Bhaktapur, Suryabinayak', NULL),
('Meena',  'Tamang',   '2000-03-18', 'Female', 'AB+', 'meena.tamang@gmail.com', '9851000004', 'Kathmandu, Chabahil',     'Sulfa drugs');

-- Room types
INSERT INTO room_types (name, description, daily_rate) VALUES
('General Ward',   '6-bed open ward',               500.00),
('Semi-Private',   '2-bed shared room',             1200.00),
('Private',        'Single occupancy room',         2500.00),
('ICU',            'Intensive care unit bed',       5000.00),
('Operation Theatre', 'Surgical procedure room',   8000.00);

-- Rooms
INSERT INTO rooms (room_number, room_type_id, department_id, floor, total_beds) VALUES
('G-101', 1, 1, 1, 6),
('G-102', 1, 1, 1, 6),
('S-201', 2, 2, 2, 2),
('P-202', 3, 2, 2, 1),
('ICU-01',4, 6, 3, 4);

-- Beds
INSERT INTO beds (room_id, bed_number, status) VALUES
(1,'A','Available'),(1,'B','Available'),(1,'C','Available'),
(1,'D','Available'),(1,'E','Available'),(1,'F','Available'),
(2,'A','Available'),(2,'B','Available'),(2,'C','Available'),
(2,'D','Available'),(2,'E','Available'),(2,'F','Available'),
(3,'A','Available'),(3,'B','Available'),
(4,'A','Available'),
(5,'A','Available'),(5,'B','Available'),(5,'C','Available'),(5,'D','Available');

-- Medicines
INSERT INTO medicines (name, generic_name, category, manufacturer, unit_price) VALUES
('Paracetamol 500mg', 'Paracetamol',  'Analgesic',    'Nepal Pharma', 5.00),
('Amoxicillin 500mg', 'Amoxicillin',  'Antibiotic',   'Nepal Pharma', 12.00),
('Atorvastatin 10mg', 'Atorvastatin', 'Statin',       'Astra Nepal',  25.00),
('Metformin 500mg',   'Metformin',    'Antidiabetic', 'Astra Nepal',  8.00),
('Omeprazole 20mg',   'Omeprazole',   'PPI',          'Nepal Pharma', 10.00);

INSERT INTO medicine_stock (medicine_id, quantity, reorder_level, expiry_date) VALUES
(1, 500, 100, '2026-12-31'),
(2, 200,  50, '2026-06-30'),
(3,  40,  50, '2027-01-31'),
(4, 300,  75, '2026-09-30'),
(5, 150,  50, '2026-11-30');

-- Lab tests
INSERT INTO lab_tests (test_name, category, normal_range, unit, base_price) VALUES
('Complete Blood Count',      'Haematology',  'Varies',    '',       300.00),
('Fasting Blood Sugar',       'Biochemistry', '70–100',    'mg/dL',  150.00),
('Lipid Profile',             'Biochemistry', 'Total <200','mg/dL',  500.00),
('Urine Routine Examination', 'Urinalysis',   'Normal',    '',       100.00),
('Serum Creatinine',          'Biochemistry', '0.6–1.2',   'mg/dL',  200.00);


-- ============================================================
-- SECTION 12 — EXAMPLE CALLS
-- ============================================================
/*
-- Admit a patient to bed 1
CALL sp_admit_patient(1, 1, 1, 1, 'Chest pain observation', DATE_ADD(CURDATE(), INTERVAL 3 DAY), @adm_id, @msg);
SELECT @adm_id, @msg;

-- Discharge
CALL sp_discharge_patient(@adm_id, 'Patient stable, discharged on oral medication.', @msg);
SELECT @msg;

-- Book an outpatient appointment
CALL sp_book_appointment(2, 2, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '10:00:00', 'Cardiac checkup', @appt_id, @msg);
SELECT @appt_id, @msg;

-- Generate a bill
CALL sp_generate_bill(2, @appt_id, NULL, 0.00, @bill_id, @total);
SELECT @bill_id, @total;

-- Record a payment
CALL sp_record_payment(@bill_id, @total, 'Cash', NULL, 1, @status, @balance);
SELECT @status, @balance;

-- Full patient history
CALL sp_patient_history(1);

-- Views
SELECT * FROM vw_todays_appointments;
SELECT * FROM vw_bed_occupancy;
SELECT * FROM vw_outstanding_bills;
SELECT * FROM vw_low_stock;
SELECT * FROM vw_doctor_revenue;
SELECT * FROM vw_patient_summary;
*/

-- ============================================================
--   END OF SCHEMA v2.0
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ████  PART 2 — ADMISSION FEATURES PATCH  ████████████████
-- ════════════════════════════════════════════════════════════
--
--  Adds: visit_type on admissions, waiting list table,
--        transfer log table, 2 new views, 4 stored procedures
--        (sp_register_patient, updated sp_admit_patient,
--         sp_transfer_patient, sp_discharge_and_bill),
--        1 new trigger (trg_release_waiting_list).
-- ════════════════════════════════════════════════════════════

-- ============================================================
--   ADMISSION PATCH — applies on top of hospital_db_v2.sql
--   Adds:
--     1.  visit_type column on admissions
--     2.  admission_waiting_list table
--     3.  admission_transfers table
--     4.  vw_available_beds  view
--     5.  vw_waiting_list    view
--     6.  sp_register_patient          (receptionist: new patient)
--     7.  sp_admit_patient             (replaces v2 version — now handles visit_type + waiting list check)
--     8.  sp_transfer_patient          (receptionist: move to another bed)
--     9.  sp_discharge_and_bill        (receptionist: discharge + auto-generate final bill)
--     10. trg_release_waiting_list     (trigger: notify next in queue when bed freed)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
-- 1.  ADD visit_type TO admissions
-- ============================================================

ALTER TABLE admissions
    ADD COLUMN visit_type ENUM('Emergency','Planned','Transfer') NOT NULL DEFAULT 'Planned'
    AFTER admission_reason;


-- ============================================================
-- 2.  WAITING LIST
--     One row per patient waiting for a specific room type.
--     Resolved = manually admitted or cancelled.
-- ============================================================

CREATE TABLE admission_waiting_list (
    waiting_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id      INT UNSIGNED NOT NULL,
    doctor_id       INT UNSIGNED NOT NULL,      -- requesting doctor
    handled_by      INT UNSIGNED,               -- staff_id (receptionist)
    room_type_id    INT UNSIGNED NOT NULL,      -- what type of bed they need
    visit_type      ENUM('Emergency','Planned','Transfer') NOT NULL DEFAULT 'Planned',
    priority        TINYINT UNSIGNED NOT NULL DEFAULT 5,   -- 1 = highest, 10 = lowest
    reason          TEXT,
    requested_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP DEFAULT NULL,
    status          ENUM('Waiting','Admitted','Cancelled') NOT NULL DEFAULT 'Waiting',
    notes           TEXT,

    CONSTRAINT fk_wl_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_wl_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_wl_staff
        FOREIGN KEY (handled_by) REFERENCES staff(staff_id)
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_wl_room_type
        FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,

    INDEX idx_wl_status   (status),
    INDEX idx_wl_priority (priority, requested_at)
);


-- ============================================================
-- 3.  TRANSFER LOG
--     Tracks every time a patient moves between beds.
-- ============================================================

CREATE TABLE admission_transfers (
    transfer_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admission_id    INT UNSIGNED NOT NULL,
    from_bed_id     INT UNSIGNED NOT NULL,
    to_bed_id       INT UNSIGNED NOT NULL,
    transferred_by  INT UNSIGNED,               -- staff_id
    transfer_reason VARCHAR(255),
    transferred_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tr_admission
        FOREIGN KEY (admission_id) REFERENCES admissions(admission_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_tr_from_bed
        FOREIGN KEY (from_bed_id) REFERENCES beds(bed_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_tr_to_bed
        FOREIGN KEY (to_bed_id) REFERENCES beds(bed_id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_tr_staff
        FOREIGN KEY (transferred_by) REFERENCES staff(staff_id)
        ON DELETE SET NULL ON UPDATE CASCADE
);


-- ============================================================
-- 4.  VIEWS
-- ============================================================

-- 4.1  Available beds (what the receptionist sees when admitting)
CREATE OR REPLACE VIEW vw_available_beds AS
SELECT
    b.bed_id,
    b.bed_number,
    r.room_id,
    r.room_number,
    r.floor,
    rt.room_type_id,
    rt.name         AS room_type,
    rt.daily_rate,
    dep.name        AS department
FROM beds b
JOIN rooms        r   ON b.room_id      = r.room_id
JOIN room_types   rt  ON r.room_type_id = rt.room_type_id
LEFT JOIN departments dep ON r.department_id = dep.department_id
WHERE b.status    = 'Available'
  AND r.is_active = TRUE
ORDER BY rt.name, r.room_number, b.bed_number;

-- 4.2  Waiting list (priority order, open items only)
CREATE OR REPLACE VIEW vw_waiting_list AS
SELECT
    wl.waiting_id,
    wl.priority,
    wl.visit_type,
    wl.requested_at,
    CONCAT(p.first_name, ' ', p.last_name)  AS patient_name,
    p.phone                                  AS patient_phone,
    CONCAT(d.first_name, ' ', d.last_name)  AS requesting_doctor,
    rt.name                                  AS requested_room_type,
    wl.reason,
    wl.notes,
    -- How many beds of this type are currently free
    (SELECT COUNT(*) FROM vw_available_beds ab
     WHERE ab.room_type_id = wl.room_type_id)  AS beds_available
FROM admission_waiting_list wl
JOIN patients   p  ON wl.patient_id   = p.patient_id
JOIN doctors    d  ON wl.doctor_id    = d.doctor_id
JOIN room_types rt ON wl.room_type_id = rt.room_type_id
WHERE wl.status = 'Waiting'
ORDER BY wl.priority ASC, wl.requested_at ASC;


-- ============================================================
-- 5.  STORED PROCEDURES
-- ============================================================

DELIMITER $$

-- ----------------------------------------------------------
-- 5.1  sp_register_patient
--      Receptionist creates a new patient record.
--      Returns the new patient_id, or 0 if phone already exists.
-- ----------------------------------------------------------
CREATE PROCEDURE sp_register_patient (
    IN  p_first_name    VARCHAR(60),
    IN  p_last_name     VARCHAR(60),
    IN  p_dob           DATE,
    IN  p_gender        ENUM('Male','Female','Other'),
    IN  p_blood_group   VARCHAR(5),
    IN  p_phone         VARCHAR(20),
    IN  p_email         VARCHAR(120),
    IN  p_address       TEXT,
    IN  p_allergies     TEXT,
    IN  p_emg_name      VARCHAR(120),
    IN  p_emg_phone     VARCHAR(20),
    OUT p_patient_id    INT UNSIGNED,
    OUT p_message       VARCHAR(200)
)
BEGIN
    DECLARE v_exists INT DEFAULT 0;

    -- Duplicate phone check
    SELECT COUNT(*) INTO v_exists
    FROM patients WHERE phone = p_phone;

    IF v_exists > 0 THEN
        -- Return existing patient id so receptionist can confirm
        SELECT patient_id INTO p_patient_id
        FROM patients WHERE phone = p_phone LIMIT 1;
        SET p_message = CONCAT('Warning: Phone already registered. Existing patient_id = ', p_patient_id, '.');
    ELSE
        INSERT INTO patients
            (first_name, last_name, date_of_birth, gender, blood_group,
             phone, email, address, allergies,
             emergency_contact_name, emergency_contact_phone)
        VALUES
            (p_first_name, p_last_name, p_dob, p_gender, p_blood_group,
             p_phone, p_email, p_address, p_allergies,
             p_emg_name, p_emg_phone);

        SET p_patient_id = LAST_INSERT_ID();
        SET p_message = CONCAT('Success: Patient #', p_patient_id, ' registered.');
    END IF;
END$$


-- ----------------------------------------------------------
-- 5.2  sp_admit_patient  (replaces v2 version)
--      Receptionist assigns a bed and records visit_type.
--      If no bed is free → automatically adds to waiting list
--      and returns admission_id = 0.
-- ----------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_admit_patient$$

CREATE PROCEDURE sp_admit_patient (
    IN  p_patient_id    INT UNSIGNED,
    IN  p_bed_id        INT UNSIGNED,       -- pass NULL to auto-waitlist
    IN  p_doctor_id     INT UNSIGNED,
    IN  p_staff_id      INT UNSIGNED,
    IN  p_reason        TEXT,
    IN  p_visit_type    ENUM('Emergency','Planned','Transfer'),
    IN  p_exp_discharge DATE,
    OUT p_admission_id  INT UNSIGNED,
    OUT p_message       VARCHAR(200)
)
BEGIN
    DECLARE v_bed_status  VARCHAR(30) DEFAULT NULL;
    DECLARE v_room_type   INT UNSIGNED;

    -- ── Case 1: specific bed requested ──────────────────────
    IF p_bed_id IS NOT NULL THEN
        SELECT b.status, r.room_type_id
        INTO   v_bed_status, v_room_type
        FROM beds b JOIN rooms r ON b.room_id = r.room_id
        WHERE b.bed_id = p_bed_id;

        IF v_bed_status IS NULL THEN
            SET p_admission_id = 0;
            SET p_message = 'Error: Bed not found.';

        ELSEIF v_bed_status != 'Available' THEN
            -- Bed taken → add to waiting list for that room type
            INSERT INTO admission_waiting_list
                (patient_id, doctor_id, handled_by, room_type_id, visit_type,
                 priority, reason)
            VALUES
                (p_patient_id, p_doctor_id, p_staff_id, v_room_type, p_visit_type,
                 IF(p_visit_type = 'Emergency', 1, 5), p_reason);

            SET p_admission_id = 0;
            SET p_message = CONCAT('Bed unavailable. Added to waiting list. Entry #',
                                   LAST_INSERT_ID(), '.');
        ELSE
            -- Bed is free → admit
            INSERT INTO admissions
                (patient_id, bed_id, admitting_doctor_id, admitted_by,
                 admission_reason, visit_type, expected_discharge)
            VALUES
                (p_patient_id, p_bed_id, p_doctor_id, p_staff_id,
                 p_reason, p_visit_type, p_exp_discharge);

            SET p_admission_id = LAST_INSERT_ID();
            UPDATE beds SET status = 'Occupied' WHERE bed_id = p_bed_id;
            SET p_message = CONCAT('Success: Admitted. Admission #', p_admission_id, '.');
        END IF;

    -- ── Case 2: no specific bed — find first available ──────
    ELSE
        SELECT b.bed_id INTO p_bed_id
        FROM beds b
        JOIN rooms r ON b.room_id = r.room_id
        WHERE b.status = 'Available' AND r.is_active = TRUE
        ORDER BY b.bed_id
        LIMIT 1;

        IF p_bed_id IS NULL THEN
            -- No beds at all → waiting list (general, room_type_id = 1 as default)
            INSERT INTO admission_waiting_list
                (patient_id, doctor_id, handled_by, room_type_id, visit_type,
                 priority, reason)
            VALUES
                (p_patient_id, p_doctor_id, p_staff_id, 1, p_visit_type,
                 IF(p_visit_type = 'Emergency', 1, 5), p_reason);

            SET p_admission_id = 0;
            SET p_message = CONCAT('No beds available. Added to waiting list. Entry #',
                                   LAST_INSERT_ID(), '.');
        ELSE
            INSERT INTO admissions
                (patient_id, bed_id, admitting_doctor_id, admitted_by,
                 admission_reason, visit_type, expected_discharge)
            VALUES
                (p_patient_id, p_bed_id, p_doctor_id, p_staff_id,
                 p_reason, p_visit_type, p_exp_discharge);

            SET p_admission_id = LAST_INSERT_ID();
            UPDATE beds SET status = 'Occupied' WHERE bed_id = p_bed_id;
            SET p_message = CONCAT('Success: Admitted to bed #', p_bed_id,
                                   '. Admission #', p_admission_id, '.');
        END IF;
    END IF;
END$$


-- ----------------------------------------------------------
-- 5.3  sp_transfer_patient
--      Move an active admission to a different bed.
--      Frees the old bed, marks the new one Occupied,
--      and logs the move in admission_transfers.
-- ----------------------------------------------------------
CREATE PROCEDURE sp_transfer_patient (
    IN  p_admission_id  INT UNSIGNED,
    IN  p_new_bed_id    INT UNSIGNED,
    IN  p_staff_id      INT UNSIGNED,
    IN  p_reason        VARCHAR(255),
    OUT p_message       VARCHAR(200)
)
BEGIN
    DECLARE v_old_bed_id    INT UNSIGNED;
    DECLARE v_adm_status    VARCHAR(20);
    DECLARE v_new_bed_status VARCHAR(30);

    SELECT bed_id, status
    INTO   v_old_bed_id, v_adm_status
    FROM admissions WHERE admission_id = p_admission_id;

    SELECT status INTO v_new_bed_status
    FROM beds WHERE bed_id = p_new_bed_id;

    IF v_old_bed_id IS NULL THEN
        SET p_message = 'Error: Admission not found.';

    ELSEIF v_adm_status != 'Active' THEN
        SET p_message = CONCAT('Error: Admission is ', v_adm_status, ', cannot transfer.');

    ELSEIF v_new_bed_status IS NULL THEN
        SET p_message = 'Error: Target bed not found.';

    ELSEIF v_new_bed_status != 'Available' THEN
        SET p_message = CONCAT('Error: Target bed is ', v_new_bed_status, '.');

    ELSE
        -- Log the transfer
        INSERT INTO admission_transfers
            (admission_id, from_bed_id, to_bed_id, transferred_by, transfer_reason)
        VALUES
            (p_admission_id, v_old_bed_id, p_new_bed_id, p_staff_id, p_reason);

        -- Swap beds
        UPDATE beds SET status = 'Available' WHERE bed_id = v_old_bed_id;
        UPDATE beds SET status = 'Occupied'  WHERE bed_id = p_new_bed_id;

        -- Update admission record
        UPDATE admissions SET bed_id = p_new_bed_id
        WHERE admission_id = p_admission_id;

        SET p_message = CONCAT('Success: Transferred from bed #', v_old_bed_id,
                               ' to bed #', p_new_bed_id, '.');
    END IF;
END$$


-- ----------------------------------------------------------
-- 5.4  sp_discharge_and_bill
--      Single call for receptionist to:
--        1. Discharge the patient (free the bed)
--        2. Auto-generate the final bill (room + labs + consult)
--      Returns bill_id and total_amount.
-- ----------------------------------------------------------
CREATE PROCEDURE sp_discharge_and_bill (
    IN  p_admission_id  INT UNSIGNED,
    IN  p_staff_id      INT UNSIGNED,
    IN  p_summary       TEXT,
    IN  p_discount_pct  DECIMAL(5,2),
    OUT p_bill_id       INT UNSIGNED,
    OUT p_total         DECIMAL(12,2),
    OUT p_message       VARCHAR(200)
)
BEGIN
    DECLARE v_bed_id        INT UNSIGNED;
    DECLARE v_patient_id    INT UNSIGNED;
    DECLARE v_adm_status    VARCHAR(20);
    DECLARE v_tax           DECIMAL(5,2) DEFAULT 13.00;
    DECLARE v_subtotal      DECIMAL(12,2);

    SELECT bed_id, patient_id, status
    INTO   v_bed_id, v_patient_id, v_adm_status
    FROM admissions WHERE admission_id = p_admission_id;

    IF v_bed_id IS NULL THEN
        SET p_bill_id = 0; SET p_total = 0;
        SET p_message = 'Error: Admission not found.';

    ELSEIF v_adm_status != 'Active' THEN
        SET p_bill_id = 0; SET p_total = 0;
        SET p_message = CONCAT('Error: Admission is already ', v_adm_status, '.');

    ELSE
        -- ── Step 1: discharge ──────────────────────────────
        UPDATE admissions
        SET status            = 'Discharged',
            actual_discharge  = NOW(),
            discharge_summary = p_summary
        WHERE admission_id = p_admission_id;

        UPDATE beds SET status = 'Available' WHERE bed_id = v_bed_id;

        -- ── Step 2: create bill header ─────────────────────
        INSERT INTO bills
            (patient_id, admission_id, bill_date, due_date,
             discount_pct, tax_pct, status)
        VALUES
            (v_patient_id, p_admission_id, CURDATE(),
             DATE_ADD(CURDATE(), INTERVAL 30 DAY),
             p_discount_pct, v_tax, 'Draft');

        SET p_bill_id = LAST_INSERT_ID();

        -- ── Step 3: room charges ───────────────────────────
        INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price)
        SELECT
            p_bill_id,
            'Room',
            CONCAT(rt.name, ' — ', r.room_number, ', Bed ', b.bed_number),
            GREATEST(DATEDIFF(NOW(), adm.admission_date), 1),
            rt.daily_rate
        FROM admissions adm
        JOIN beds       b  ON adm.bed_id        = b.bed_id
        JOIN rooms      r  ON b.room_id          = r.room_id
        JOIN room_types rt ON r.room_type_id     = rt.room_type_id
        WHERE adm.admission_id = p_admission_id;

        -- ── Step 4: consultation fees for inpatient records ─
        INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price)
        SELECT
            p_bill_id,
            'Consultation',
            CONCAT('Dr. ', d.first_name, ' ', d.last_name, ' — ', mr.visit_date),
            1,
            d.consultation_fee
        FROM medical_records mr
        JOIN doctors d ON mr.doctor_id = d.doctor_id
        WHERE mr.admission_id = p_admission_id;

        -- ── Step 5: lab tests ordered during admission ──────
        INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price)
        SELECT
            p_bill_id,
            'Lab Test',
            lt.test_name,
            1,
            lt.base_price
        FROM lab_results lr
        JOIN lab_tests       lt ON lr.test_id  = lt.test_id
        JOIN medical_records mr ON lr.record_id = mr.record_id
        WHERE mr.admission_id = p_admission_id
          AND lr.status       != 'Cancelled';

        -- ── Step 6: finalise totals ────────────────────────
        SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
        FROM bill_items WHERE bill_id = p_bill_id;

        UPDATE bills
        SET subtotal     = v_subtotal,
            total_amount = v_subtotal
                           * (1 - p_discount_pct / 100)
                           * (1 + v_tax / 100),
            status       = 'Issued'
        WHERE bill_id = p_bill_id;

        SELECT total_amount INTO p_total
        FROM bills WHERE bill_id = p_bill_id;

        SET p_message = CONCAT('Success: Discharged & bill #', p_bill_id,
                               ' issued. Total: NPR ', p_total, '.');
    END IF;
END$$

DELIMITER ;


-- ============================================================
-- 6.  TRIGGER — release waiting list when a bed is freed
--     When a bed becomes Available, mark the highest-priority
--     waiting entry for that room type as ready (notes updated).
--     The receptionist then confirms the actual admission.
-- ============================================================

DELIMITER $$

CREATE TRIGGER trg_release_waiting_list
AFTER UPDATE ON beds
FOR EACH ROW
BEGIN
    DECLARE v_room_type_id INT UNSIGNED;
    DECLARE v_waiting_id   INT UNSIGNED;

    IF NEW.status = 'Available' AND OLD.status = 'Occupied' THEN

        -- Find room type of the freed bed
        SELECT r.room_type_id INTO v_room_type_id
        FROM rooms r
        JOIN beds  b ON b.room_id = r.room_id
        WHERE b.bed_id = NEW.bed_id;

        -- Find the top waiting entry for that room type
        SELECT waiting_id INTO v_waiting_id
        FROM admission_waiting_list
        WHERE room_type_id = v_room_type_id
          AND status       = 'Waiting'
        ORDER BY priority ASC, requested_at ASC
        LIMIT 1;

        IF v_waiting_id IS NOT NULL THEN
            UPDATE admission_waiting_list
            SET notes = CONCAT(
                    COALESCE(notes, ''),
                    ' | Bed #', NEW.bed_id, ' available as of ', NOW(), ' — pending receptionist confirmation.')
            WHERE waiting_id = v_waiting_id;
        END IF;

    END IF;
END$$

DELIMITER ;


-- ============================================================
-- SECTION 7 — EXAMPLE CALLS
-- ============================================================
/*
-- Register a new patient (receptionist)
CALL sp_register_patient(
    'Binod','Karki','1995-08-10','Male','O+',
    '9860000001','binod.karki@gmail.com',
    'Kathmandu, Maharajgunj', 'None',
    'Sita Karki','9860000002',
    @pid, @msg
);
SELECT @pid AS patient_id, @msg;

-- Admit with a specific bed and visit type
CALL sp_admit_patient(@pid, 1, 1, 1, 'Fever — observation needed', 'Planned',
                      DATE_ADD(CURDATE(), INTERVAL 3 DAY), @adm_id, @msg);
SELECT @adm_id, @msg;

-- If bed is full — same call automatically adds to waiting list
CALL sp_admit_patient(@pid, 1, 1, 1, 'Emergency chest pain', 'Emergency',
                      NULL, @adm_id, @msg);
SELECT @adm_id, @msg;

-- Transfer to a different bed
CALL sp_transfer_patient(@adm_id, 5, 1, 'Patient requested private room', @msg);
SELECT @msg;

-- Discharge and generate bill in one call
CALL sp_discharge_and_bill(@adm_id, 1,
    'Patient recovered, discharged on oral antibiotics.',
    0.00, @bill_id, @total, @msg);
SELECT @bill_id, @total, @msg;

-- Check waiting list
SELECT * FROM vw_waiting_list;

-- Check bed availability (before admitting)
SELECT * FROM vw_available_beds;
*/

-- ============================================================
--   END OF PATCH
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- ████  PART 3 — SEED DATA  ███████████████████████████████
-- ════════════════════════════════════════════════════════════
--
--  Realistic Nepali hospital data:
--  9 departments, 10 doctors, 8 staff, 20 patients, 14 rooms,
--  48 beds, 25 medicines, 18 lab tests, 30 appointments,
--  17 medical records, 15 prescriptions, 16 lab results,
--  11 admissions, 3 waiting list entries, 11 bills, 7 payments.
--
--  Starts with TRUNCATE — safe to re-run.
-- ════════════════════════════════════════════════════════════

-- ============================================================
--   HOSPITAL MANAGEMENT SYSTEM — Seed Data
--   Context : Himalaya General Hospital, Kathmandu, Nepal
--   Run after : hospital_db_v2.sql + admission_patch.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- DROP ALL TRIGGERS for clean seeding
--   trg_no_past_appointments -> blocks historical appointments
--   trg_deduct_stock         -> double-deducts medicine stock
--   trg_payment_status       -> overwrites seeded bill statuses
--   trg_complete_appointment -> redundant during seed
--   trg_check_bed_on_admit   -> dropped for consistency
--   trg_release_waiting_list -> dropped for consistency
-- All six recreated at the bottom of this file.
-- ============================================================
DROP TRIGGER IF EXISTS trg_no_past_appointments;
DROP TRIGGER IF EXISTS trg_complete_appointment;
DROP TRIGGER IF EXISTS trg_deduct_stock;
DROP TRIGGER IF EXISTS trg_payment_status;
DROP TRIGGER IF EXISTS trg_check_bed_on_admit;
DROP TRIGGER IF EXISTS trg_release_waiting_list;


-- ============================================================
-- TRUNCATE all tables (safe re-run)
-- ============================================================
TRUNCATE TABLE payments;
TRUNCATE TABLE bill_items;
TRUNCATE TABLE bills;
TRUNCATE TABLE admission_transfers;
TRUNCATE TABLE admission_waiting_list;
TRUNCATE TABLE admissions;
TRUNCATE TABLE lab_results;
TRUNCATE TABLE prescription_items;
TRUNCATE TABLE prescriptions;
TRUNCATE TABLE medical_records;
TRUNCATE TABLE appointments;
TRUNCATE TABLE medicine_stock;
TRUNCATE TABLE medicines;
TRUNCATE TABLE lab_tests;
TRUNCATE TABLE beds;
TRUNCATE TABLE rooms;
TRUNCATE TABLE room_types;
TRUNCATE TABLE staff;
TRUNCATE TABLE doctors;
TRUNCATE TABLE patients;
TRUNCATE TABLE users;
TRUNCATE TABLE role_permissions;
TRUNCATE TABLE permissions;
TRUNCATE TABLE roles;
TRUNCATE TABLE departments;

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- 1. ROLES
-- ============================================================
INSERT INTO roles (role_id, name, description) VALUES
(1, 'admin',          'Full system access'),
(2, 'doctor',         'Clinical records, appointments, prescriptions'),
(3, 'nurse',          'View records, update vitals'),
(4, 'receptionist',   'Appointments, admissions, billing'),
(5, 'pharmacist',     'Medicines and stock management'),
(6, 'lab_technician', 'Lab tests and results');


-- ============================================================
-- 2. PERMISSIONS
-- ============================================================
INSERT INTO permissions (permission_id, name, description) VALUES
(1,  'users.manage',        'Create / edit / deactivate users'),
(2,  'records.view',        'View patient medical records'),
(3,  'records.edit',        'Create and update medical records'),
(4,  'appointments.manage', 'Book, reschedule, cancel appointments'),
(5,  'billing.create',      'Generate bills'),
(6,  'billing.payment',     'Record payments'),
(7,  'pharmacy.manage',     'Manage medicines and stock'),
(8,  'lab.manage',          'Order and update lab results'),
(9,  'admissions.manage',   'Admit and discharge patients'),
(10, 'reports.view',        'View revenue and summary reports');


-- ============================================================
-- 3. ROLE → PERMISSION
-- ============================================================
INSERT INTO role_permissions (role_id, permission_id) VALUES
-- admin: everything
(1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),
-- doctor
(2,2),(2,3),(2,4),(2,8),
-- nurse
(3,2),(3,3),
-- receptionist
(4,2),(4,4),(4,5),(4,6),(4,9),
-- pharmacist
(5,2),(5,7),
-- lab technician
(6,2),(6,8);


-- ============================================================
-- 4. DEPARTMENTS  (9 departments)
-- ============================================================
INSERT INTO departments (department_id, name, description, location) VALUES
(1,  'General Medicine',     'Primary care and internal medicine',        'Block A, Floor 1'),
(2,  'Cardiology',           'Heart and cardiovascular care',             'Block B, Floor 2'),
(3,  'Orthopaedics',         'Bone, joint and musculoskeletal care',      'Block A, Floor 2'),
(4,  'Pathology & Lab',      'Diagnostic laboratory services',            'Block C, Ground'),
(5,  'Pharmacy',             'Medicine dispensing and stock',             'Block A, Ground'),
(6,  'ICU',                  'Intensive care unit',                       'Block B, Floor 3'),
(7,  'Gynaecology & OB',     'Women health and maternity',                'Block D, Floor 1'),
(8,  'Paediatrics',          'Child health and neonatology',              'Block D, Floor 2'),
(9,  'Emergency',            '24/7 emergency and trauma care',            'Block E, Ground');


-- ============================================================
-- 5. USERS  (all passwords = "Hospital@123" bcrypt placeholder)
-- ============================================================
INSERT INTO users (user_id, email, password_hash, role_id, is_active) VALUES
-- admin
(1,  'admin@himalaya.np',           '$2b$12$KIX.placeholder.admin.hash.xyz', 1, TRUE),
-- doctors (user_id 2–11)
(2,  'ramesh.sharma@himalaya.np',   '$2b$12$KIX.placeholder.doc1.hash.xyz',  2, TRUE),
(3,  'sunita.thapa@himalaya.np',    '$2b$12$KIX.placeholder.doc2.hash.xyz',  2, TRUE),
(4,  'bikash.acharya@himalaya.np',  '$2b$12$KIX.placeholder.doc3.hash.xyz',  2, TRUE),
(5,  'pratima.rai@himalaya.np',     '$2b$12$KIX.placeholder.doc4.hash.xyz',  2, TRUE),
(6,  'dipak.shrestha@himalaya.np',  '$2b$12$KIX.placeholder.doc5.hash.xyz',  2, TRUE),
(7,  'anupama.joshi@himalaya.np',   '$2b$12$KIX.placeholder.doc6.hash.xyz',  2, TRUE),
(8,  'nirajan.maharjan@himalaya.np','$2b$12$KIX.placeholder.doc7.hash.xyz',  2, TRUE),
(9,  'sabina.gurung@himalaya.np',   '$2b$12$KIX.placeholder.doc8.hash.xyz',  2, TRUE),
(10, 'rajan.pandey@himalaya.np',    '$2b$12$KIX.placeholder.doc9.hash.xyz',  2, TRUE),
(11, 'mina.tamang@himalaya.np',     '$2b$12$KIX.placeholder.doc10.hash.xyz', 2, TRUE),
-- receptionists (12–13)
(12, 'anita.gurung@himalaya.np',    '$2b$12$KIX.placeholder.rec1.hash.xyz',  4, TRUE),
(13, 'rohan.basnet@himalaya.np',    '$2b$12$KIX.placeholder.rec2.hash.xyz',  4, TRUE),
-- nurses (14–17)
(14, 'kamala.kc@himalaya.np',       '$2b$12$KIX.placeholder.nur1.hash.xyz',  3, TRUE),
(15, 'sita.lama@himalaya.np',       '$2b$12$KIX.placeholder.nur2.hash.xyz',  3, TRUE),
(16, 'bimala.rana@himalaya.np',     '$2b$12$KIX.placeholder.nur3.hash.xyz',  3, TRUE),
(17, 'puja.karki@himalaya.np',      '$2b$12$KIX.placeholder.nur4.hash.xyz',  3, TRUE),
-- pharmacists (18–19)
(18, 'suresh.bista@himalaya.np',    '$2b$12$KIX.placeholder.pha1.hash.xyz',  5, TRUE),
(19, 'nirmala.oli@himalaya.np',     '$2b$12$KIX.placeholder.pha2.hash.xyz',  5, TRUE),
-- lab technicians (20–21)
(20, 'deepak.khatri@himalaya.np',   '$2b$12$KIX.placeholder.lab1.hash.xyz',  6, TRUE),
(21, 'asha.magar@himalaya.np',      '$2b$12$KIX.placeholder.lab2.hash.xyz',  6, TRUE);


-- ============================================================
-- 6. DOCTORS  (10 doctors across departments)
-- ============================================================
INSERT INTO doctors (doctor_id, user_id, first_name, last_name, phone, specialization,
    department_id, license_number, consultation_fee,
    available_days, available_from, available_to, joined_date) VALUES
(1,  2,  'Ramesh',   'Sharma',     '9841100001', 'General Physician',       1, 'NMC-1001', 600.00,  'Mon,Tue,Wed,Thu,Fri',        '09:00', '17:00', '2016-04-01'),
(2,  3,  'Sunita',   'Thapa',      '9841100002', 'Cardiologist',            2, 'NMC-1002', 1800.00, 'Mon,Tue,Wed,Thu,Fri',        '10:00', '16:00', '2017-08-15'),
(3,  4,  'Bikash',   'Acharya',    '9841100003', 'Orthopaedic Surgeon',     3, 'NMC-1003', 1500.00, 'Mon,Wed,Fri',                '09:00', '14:00', '2018-03-20'),
(4,  5,  'Pratima',  'Rai',        '9841100004', 'Pathologist',             4, 'NMC-1004', 900.00,  'Mon,Tue,Wed,Thu,Fri',        '08:00', '16:00', '2015-11-10'),
(5,  6,  'Dipak',    'Shrestha',   '9841100005', 'Intensivist',             6, 'NMC-1005', 2000.00, 'Mon,Tue,Wed,Thu,Fri,Sat,Sun','00:00', '23:59', '2019-06-01'),
(6,  7,  'Anupama',  'Joshi',      '9841100006', 'Gynaecologist',           7, 'NMC-1006', 1400.00, 'Mon,Tue,Wed,Thu,Fri',        '09:00', '17:00', '2018-09-05'),
(7,  8,  'Nirajan',  'Maharjan',   '9841100007', 'Paediatrician',           8, 'NMC-1007', 1200.00, 'Mon,Tue,Wed,Thu,Fri,Sat',    '09:00', '15:00', '2020-02-14'),
(8,  9,  'Sabina',   'Gurung',     '9841100008', 'Emergency Physician',     9, 'NMC-1008', 800.00,  'Mon,Tue,Wed,Thu,Fri,Sat,Sun','00:00', '23:59', '2021-01-01'),
(9,  10, 'Rajan',    'Pandey',     '9841100009', 'General Physician',       1, 'NMC-1009', 600.00,  'Tue,Thu,Sat',                '10:00', '18:00', '2022-07-01'),
(10, 11, 'Mina',     'Tamang',     '9841100010', 'Cardiologist',            2, 'NMC-1010', 1800.00, 'Mon,Wed,Fri',                '11:00', '17:00', '2021-11-15');

-- Department heads
UPDATE departments SET head_doctor_id = 1  WHERE department_id = 1;
UPDATE departments SET head_doctor_id = 2  WHERE department_id = 2;
UPDATE departments SET head_doctor_id = 3  WHERE department_id = 3;
UPDATE departments SET head_doctor_id = 4  WHERE department_id = 4;
UPDATE departments SET head_doctor_id = 5  WHERE department_id = 6;
UPDATE departments SET head_doctor_id = 6  WHERE department_id = 7;
UPDATE departments SET head_doctor_id = 7  WHERE department_id = 8;
UPDATE departments SET head_doctor_id = 8  WHERE department_id = 9;


-- ============================================================
-- 7. STAFF  (8 support staff)
-- ============================================================
INSERT INTO staff (staff_id, user_id, first_name, last_name, phone, job_title, department_id, joined_date) VALUES
(1, 12, 'Anita',   'Gurung',  '9841200001', 'Senior Receptionist', 1, '2019-05-10'),
(2, 13, 'Rohan',   'Basnet',  '9841200002', 'Receptionist',        9, '2021-03-22'),
(3, 14, 'Kamala',  'KC',      '9841200003', 'Head Nurse',          1, '2018-08-01'),
(4, 15, 'Sita',    'Lama',    '9841200004', 'Staff Nurse',         2, '2020-11-15'),
(5, 16, 'Bimala',  'Rana',    '9841200005', 'Staff Nurse',         6, '2021-06-01'),
(6, 17, 'Puja',    'Karki',   '9841200006', 'Staff Nurse',         7, '2022-01-10'),
(7, 18, 'Suresh',  'Bista',   '9841200007', 'Chief Pharmacist',    5, '2017-09-01'),
(8, 20, 'Deepak',  'Khatri',  '9841200008', 'Lab Technician',      4, '2019-12-05');


-- ============================================================
-- 8. PATIENTS  (20 patients)
-- ============================================================
INSERT INTO patients (patient_id, first_name, last_name, date_of_birth, gender,
    blood_group, email, phone, address,
    emergency_contact_name, emergency_contact_phone, allergies) VALUES
(1,  'Aarav',     'Pandey',      '1990-05-12', 'Male',   'B+',  'aarav.pandey@gmail.com',    '9851100001', 'Baneshwor, Kathmandu',      'Meena Pandey',      '9851100002', 'Penicillin'),
(2,  'Priya',     'Shrestha',    '1985-11-23', 'Female', 'O+',  'priya.shr@gmail.com',       '9851100003', 'Pulchowk, Lalitpur',        'Rajan Shrestha',    '9851100004', NULL),
(3,  'Sanjay',    'Joshi',       '1972-07-30', 'Male',   'A-',  'sanjay.joshi@gmail.com',    '9851100005', 'Suryabinayak, Bhaktapur',   'Laxmi Joshi',       '9851100006', NULL),
(4,  'Meena',     'Tamang',      '2000-03-18', 'Female', 'AB+', 'meena.tamang@gmail.com',    '9851100007', 'Chabahil, Kathmandu',       'Raju Tamang',       '9851100008', 'Sulfa drugs'),
(5,  'Binod',     'Karki',       '1968-09-04', 'Male',   'O-',  'binod.karki@gmail.com',     '9851100009', 'Maharajgunj, Kathmandu',    'Sita Karki',        '9851100010', NULL),
(6,  'Gita',      'Adhikari',    '1995-01-27', 'Female', 'B-',  'gita.adh@gmail.com',        '9851100011', 'Koteshwor, Kathmandu',      'Hari Adhikari',     '9851100012', 'NSAIDs'),
(7,  'Suresh',    'Gautam',      '1988-06-15', 'Male',   'A+',  'suresh.gaut@gmail.com',     '9851100013', 'Lazimpat, Kathmandu',       'Radha Gautam',      '9851100014', NULL),
(8,  'Sabina',    'Magar',       '2003-12-01', 'Female', 'O+',  'sabina.magar@gmail.com',    '9851100015', 'Kirtipur, Kathmandu',       'Ram Magar',         '9851100016', NULL),
(9,  'Dipesh',    'Limbu',       '1979-04-22', 'Male',   'B+',  'dipesh.limbu@gmail.com',    '9851100017', 'Thamel, Kathmandu',         'Anjali Limbu',      '9851100018', 'Aspirin'),
(10, 'Anjali',    'Poudel',      '1993-08-09', 'Female', 'AB-', 'anjali.pou@gmail.com',      '9851100019', 'Patan, Lalitpur',           'Nabin Poudel',      '9851100020', NULL),
(11, 'Krishna',   'Bhattarai',   '1955-02-14', 'Male',   'A+',  'krishna.bhat@gmail.com',    '9851100021', 'Naxal, Kathmandu',          'Radha Bhattarai',   '9851100022', 'Iodine contrast'),
(12, 'Lakshmi',   'Yadav',       '1940-10-05', 'Female', 'O+',  'lakshmi.yadav@gmail.com',   '9851100023', 'Birgunj, Parsa',            'Mohan Yadav',       '9851100024', NULL),
(13, 'Rohan',     'Thakur',      '2015-07-19', 'Male',   'B+',  NULL,                        '9851100025', 'Janakpur, Dhanusha',        'Suman Thakur',      '9851100026', NULL),
(14, 'Nisha',     'Subedi',      '1998-03-30', 'Female', 'A+',  'nisha.sub@gmail.com',       '9851100027', 'Bhaisepati, Lalitpur',      'Dev Subedi',        '9851100028', 'Latex'),
(15, 'Prakash',   'Ghimire',     '1965-11-11', 'Male',   'O+',  'prakash.ghim@gmail.com',    '9851100029', 'Gwarko, Lalitpur',          'Durga Ghimire',     '9851100030', NULL),
(16, 'Suman',     'Nepali',      '1983-05-25', 'Male',   'B+',  'suman.nep@gmail.com',       '9851100031', 'Budhanilkantha, Kathmandu', 'Rita Nepali',       '9851100032', NULL),
(17, 'Radha',     'Lama',        '1975-09-08', 'Female', 'AB+', 'radha.lama@gmail.com',      '9851100033', 'Boudha, Kathmandu',         'Sonam Lama',        '9851100034', 'Codeine'),
(18, 'Bikram',    'Rai',         '2010-01-20', 'Male',   'O+',  NULL,                        '9851100035', 'Dharan, Sunsari',           'Mira Rai',          '9851100036', NULL),
(19, 'Sunita',    'Chaudhary',   '1992-06-17', 'Female', 'A-',  'sunita.chau@gmail.com',     '9851100037', 'Nepalgunj, Banke',          'Ramu Chaudhary',    '9851100038', NULL),
(20, 'Ganesh',    'Baral',       '1948-12-03', 'Male',   'B-',  NULL,                        '9851100039', 'Pokhara, Kaski',            'Bishnu Baral',      '9851100040', 'Morphine');


-- ============================================================
-- 9. ROOM TYPES
-- ============================================================
INSERT INTO room_types (room_type_id, name, description, daily_rate) VALUES
(1, 'General Ward',      '6-bed open ward',                    500.00),
(2, 'Semi-Private',      '2-bed shared room with attached bath',1200.00),
(3, 'Private',           'Single occupancy AC room',           2500.00),
(4, 'ICU',               'Intensive care with monitoring',     6000.00),
(5, 'Maternity',         'Post-natal care room',               1800.00),
(6, 'Paediatric Ward',   '4-bed children\'s ward',              700.00);


-- ============================================================
-- 10. ROOMS  (14 rooms)
-- ============================================================
INSERT INTO rooms (room_id, room_number, room_type_id, department_id, floor, total_beds, is_active) VALUES
(1,  'GW-101', 1, 1, 1, 6, TRUE),
(2,  'GW-102', 1, 1, 1, 6, TRUE),
(3,  'GW-103', 1, 9, 1, 6, TRUE),  -- Emergency ward
(4,  'SP-201', 2, 2, 2, 2, TRUE),
(5,  'SP-202', 2, 3, 3, 2, TRUE),
(6,  'PR-203', 3, 2, 2, 2, TRUE),
(7,  'PR-204', 3, 1, 1, 2, TRUE),
(8,  'PR-205', 3, 7, 2, 2, TRUE),
(9,  'ICU-01', 4, 6, 3, 4, TRUE),
(10, 'ICU-02', 4, 6, 3, 4, TRUE),
(11, 'MAT-01', 5, 7, 1, 3, TRUE),
(12, 'MAT-02', 5, 7, 1, 3, TRUE),
(13, 'PD-301', 6, 8, 3, 6, TRUE),
(14, 'PD-302', 6, 8, 3, 6, TRUE);


-- ============================================================
-- 11. BEDS  (total 48 beds)
-- ============================================================
-- GW-101 (6 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(1,'A','Occupied'),(1,'B','Occupied'),(1,'C','Available'),
(1,'D','Available'),(1,'E','Occupied'),(1,'F','Available');
-- GW-102 (6 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(2,'A','Available'),(2,'B','Occupied'),(2,'C','Available'),
(2,'D','Occupied'),(2,'E','Available'),(2,'F','Available');
-- GW-103 emergency (6 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(3,'A','Occupied'),(3,'B','Available'),(3,'C','Occupied'),
(3,'D','Available'),(3,'E','Available'),(3,'F','Available');
-- SP-201 (2 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(4,'A','Occupied'),(4,'B','Available');
-- SP-202 (2 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(5,'A','Occupied'),(5,'B','Available');
-- PR-203 (1 bed)
INSERT INTO beds (room_id, bed_number, status) VALUES
(6,'A','Occupied');
-- PR-204 (1 bed)
INSERT INTO beds (room_id, bed_number, status) VALUES
(7,'A','Available');
-- PR-205 (1 bed)
INSERT INTO beds (room_id, bed_number, status) VALUES
(8,'A','Occupied');
-- ICU-01 (4 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(9,'1','Occupied'),(9,'2','Occupied'),(9,'3','Available'),(9,'4','Available');
-- ICU-02 (4 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(10,'1','Occupied'),(10,'2','Available'),(10,'3','Available'),(10,'4','Under Maintenance');
-- MAT-01 (2 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(11,'A','Occupied'),(11,'B','Available');
-- MAT-02 (2 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(12,'A','Available'),(12,'B','Available');
-- PD-301 (4 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(13,'A','Occupied'),(13,'B','Available'),(13,'C','Available'),(13,'D','Available');
-- PD-302 (4 beds)
INSERT INTO beds (room_id, bed_number, status) VALUES
(14,'A','Available'),(14,'B','Available'),(14,'C','Available'),(14,'D','Available');


-- ============================================================
-- 12. MEDICINES  (25 medicines)
-- ============================================================
INSERT INTO medicines (medicine_id, name, generic_name, category, manufacturer, unit_price, requires_prescription) VALUES
(1,  'Paracetamol 500mg',     'Paracetamol',        'Analgesic',          'Nepal Pharma Ltd',    5.00,   FALSE),
(2,  'Amoxicillin 500mg',     'Amoxicillin',        'Antibiotic',         'Panacea Nepal',      12.00,   TRUE),
(3,  'Atorvastatin 10mg',     'Atorvastatin',       'Statin',             'Astra Nepal',        25.00,   TRUE),
(4,  'Metformin 500mg',       'Metformin',          'Antidiabetic',       'Astra Nepal',         8.00,   TRUE),
(5,  'Omeprazole 20mg',       'Omeprazole',         'PPI',                'Nepal Pharma Ltd',   10.00,   TRUE),
(6,  'Amlodipine 5mg',        'Amlodipine',         'Antihypertensive',   'Panacea Nepal',      15.00,   TRUE),
(7,  'Metoprolol 50mg',       'Metoprolol',         'Beta Blocker',       'Astra Nepal',        18.00,   TRUE),
(8,  'Clopidogrel 75mg',      'Clopidogrel',        'Antiplatelet',       'Panacea Nepal',      35.00,   TRUE),
(9,  'Aspirin 75mg',          'Aspirin',            'Antiplatelet',       'Nepal Pharma Ltd',    6.00,   TRUE),
(10, 'Ibuprofen 400mg',       'Ibuprofen',          'NSAID',              'Nepal Pharma Ltd',    7.00,   FALSE),
(11, 'Cetirizine 10mg',       'Cetirizine',         'Antihistamine',      'Panacea Nepal',       8.00,   FALSE),
(12, 'Azithromycin 500mg',    'Azithromycin',       'Antibiotic',         'Panacea Nepal',      45.00,   TRUE),
(13, 'Diclofenac 50mg',       'Diclofenac',         'NSAID',              'Astra Nepal',         9.00,   FALSE),
(14, 'Pantoprazole 40mg',     'Pantoprazole',       'PPI',                'Nepal Pharma Ltd',   12.00,   TRUE),
(15, 'Calcium + Vit D3',      'Calcium Carbonate',  'Supplement',         'Nepal Pharma Ltd',   20.00,   FALSE),
(16, 'Iron 100mg',            'Ferrous Sulphate',   'Supplement',         'Panacea Nepal',       6.00,   FALSE),
(17, 'Folic Acid 5mg',        'Folic Acid',         'Supplement',         'Nepal Pharma Ltd',    4.00,   FALSE),
(18, 'Salbutamol Inhaler',    'Salbutamol',         'Bronchodilator',     'Astra Nepal',       180.00,   TRUE),
(19, 'Prednisolone 10mg',     'Prednisolone',       'Corticosteroid',     'Panacea Nepal',      14.00,   TRUE),
(20, 'Ciprofloxacin 500mg',   'Ciprofloxacin',      'Antibiotic',         'Nepal Pharma Ltd',   22.00,   TRUE),
(21, 'Losartan 50mg',         'Losartan',           'ARB',                'Astra Nepal',        20.00,   TRUE),
(22, 'Insulin Glargine 3ml',  'Insulin Glargine',   'Insulin',            'Novo Nordisk Nepal', 850.00,  TRUE),
(23, 'Warfarin 5mg',          'Warfarin',           'Anticoagulant',      'Panacea Nepal',      28.00,   TRUE),
(24, 'Furosemide 40mg',       'Furosemide',         'Diuretic',           'Nepal Pharma Ltd',   10.00,   TRUE),
(25, 'Dexamethasone 4mg',     'Dexamethasone',      'Corticosteroid',     'Astra Nepal',        18.00,   TRUE);


-- ============================================================
-- 13. MEDICINE STOCK
-- ============================================================
INSERT INTO medicine_stock (medicine_id, quantity, reorder_level, expiry_date) VALUES
(1,  850,  150, '2027-06-30'),
(2,  320,   80, '2026-12-31'),
(3,   55,   60, '2027-03-31'),   -- LOW STOCK
(4,  480,  100, '2027-01-31'),
(5,  290,   75, '2026-09-30'),
(6,  175,   80, '2027-04-30'),
(7,  130,   80, '2026-11-30'),
(8,   40,   50, '2027-02-28'),   -- LOW STOCK
(9,  600,  100, '2026-08-31'),
(10, 420,  100, '2027-05-31'),
(11, 380,   80, '2027-06-30'),
(12, 110,   60, '2026-10-31'),
(13, 340,  100, '2027-03-31'),
(14, 260,   75, '2026-12-31'),
(15, 500,  100, '2027-06-30'),
(16, 450,  100, '2027-04-30'),
(17, 600,  100, '2027-06-30'),
(18,  28,   30, '2026-07-31'),   -- LOW STOCK
(19,  95,   60, '2026-11-30'),
(20, 215,   80, '2027-01-31'),
(21, 160,   80, '2027-05-31'),
(22,   0,   20, '2027-02-28'),   -- OUT OF STOCK
(23,  45,   50, '2026-09-30'),   -- LOW STOCK
(24, 190,   75, '2027-03-31'),
(25,  80,   50, '2026-12-31');


-- ============================================================
-- 14. LAB TESTS  (18 tests)
-- ============================================================
INSERT INTO lab_tests (test_id, test_name, category, normal_range, unit, base_price) VALUES
(1,  'Complete Blood Count (CBC)',     'Haematology',   'RBC: 4.5–5.5 M/µL',     'M/µL',  350.00),
(2,  'Fasting Blood Sugar (FBS)',      'Biochemistry',  '70–100',                 'mg/dL', 150.00),
(3,  'HbA1c',                         'Biochemistry',  '< 5.7%',                 '%',     600.00),
(4,  'Lipid Profile',                 'Biochemistry',  'Total < 200',            'mg/dL', 550.00),
(5,  'Liver Function Test (LFT)',      'Biochemistry',  'ALT: 7–56 U/L',          'U/L',   700.00),
(6,  'Kidney Function Test (KFT)',     'Biochemistry',  'Creatinine: 0.6–1.2',    'mg/dL', 600.00),
(7,  'Urine Routine Examination',      'Urinalysis',    'Normal',                 '',      120.00),
(8,  'Thyroid Function Test (TFT)',    'Endocrinology', 'TSH: 0.4–4.0 mIU/L',    'mIU/L', 800.00),
(9,  'Electrocardiogram (ECG)',        'Cardiology',    'Normal sinus rhythm',    '',      500.00),
(10, 'Chest X-Ray',                   'Radiology',     'Normal lung fields',     '',      800.00),
(11, 'Echocardiogram',                'Cardiology',    'EF > 55%',               '%',    3500.00),
(12, 'Blood Culture',                 'Microbiology',  'No growth',              '',      950.00),
(13, 'Urine Culture',                 'Microbiology',  'No growth',              '',      700.00),
(14, 'Dengue NS1 Antigen',            'Serology',      'Negative',               '',      900.00),
(15, 'COVID-19 Antigen',              'Serology',      'Negative',               '',      500.00),
(16, 'Serum Electrolytes',            'Biochemistry',  'Na: 135–145, K: 3.5–5',  'mEq/L', 450.00),
(17, 'Prothrombin Time (PT/INR)',      'Haematology',   'INR: 0.8–1.2',           '',      400.00),
(18, 'D-Dimer',                       'Haematology',   '< 0.5',                  'µg/mL', 1200.00);


-- ============================================================
-- 15. APPOINTMENTS  (30 appointments — mix of past & upcoming)
-- ============================================================
INSERT INTO appointments (appointment_id, patient_id, doctor_id, appointment_date,
    appointment_time, reason, status) VALUES
-- Past completed
(1,  1,  1, DATE_SUB(CURDATE(), INTERVAL 30 DAY), '09:00', 'Persistent cough and fever',         'Completed'),
(2,  2,  2, DATE_SUB(CURDATE(), INTERVAL 28 DAY), '10:30', 'Chest pain evaluation',              'Completed'),
(3,  3,  3, DATE_SUB(CURDATE(), INTERVAL 25 DAY), '09:30', 'Right knee pain',                    'Completed'),
(4,  4,  6, DATE_SUB(CURDATE(), INTERVAL 22 DAY), '11:00', 'Irregular menstrual cycle',          'Completed'),
(5,  5,  1, DATE_SUB(CURDATE(), INTERVAL 20 DAY), '09:00', 'Hypertension follow-up',             'Completed'),
(6,  6,  2, DATE_SUB(CURDATE(), INTERVAL 18 DAY), '14:00', 'Palpitations',                       'Completed'),
(7,  7,  1, DATE_SUB(CURDATE(), INTERVAL 15 DAY), '10:00', 'Diabetes management',                'Completed'),
(8,  8,  7, DATE_SUB(CURDATE(), INTERVAL 14 DAY), '09:30', 'Childhood fever',                    'Completed'),
(9,  9,  3, DATE_SUB(CURDATE(), INTERVAL 12 DAY), '11:00', 'Lower back pain',                    'Completed'),
(10, 10, 6, DATE_SUB(CURDATE(), INTERVAL 10 DAY), '10:00', 'Pregnancy check – 24 weeks',        'Completed'),
(11, 11, 2, DATE_SUB(CURDATE(), INTERVAL  8 DAY), '09:00', 'Post-cardiac procedure follow-up',   'Completed'),
(12, 12, 1, DATE_SUB(CURDATE(), INTERVAL  7 DAY), '14:00', 'General weakness and fatigue',       'Completed'),
(13, 13, 7, DATE_SUB(CURDATE(), INTERVAL  6 DAY), '09:00', 'Recurring ear infection',            'Completed'),
(14, 14, 9, DATE_SUB(CURDATE(), INTERVAL  5 DAY), '11:00', 'Annual health check',                'Completed'),
(15, 15, 1, DATE_SUB(CURDATE(), INTERVAL  4 DAY), '09:30', 'Shortness of breath',                'Completed'),
(16, 16, 9, DATE_SUB(CURDATE(), INTERVAL  3 DAY), '10:00', 'Acid reflux symptoms',               'Completed'),
(17, 17, 10, DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:00', 'Hypertension check',          'Completed'),
-- Today
(18, 1,  1, CURDATE(), '09:00', 'Follow-up cough review',              'Confirmed'),
(19, 6,  2, CURDATE(), '10:30', 'Cardiology follow-up',                'Confirmed'),
(20, 8,  7, CURDATE(), '11:00', 'Paediatric check-up',                 'Scheduled'),
(21, 14, 6, CURDATE(), '14:00', 'OB-GYN consultation',                 'Scheduled'),
(22, 19, 1, CURDATE(), '15:00', 'General consultation',                'Scheduled'),
-- Upcoming
(23, 2,  10,DATE_ADD(CURDATE(), INTERVAL 1 DAY),  '10:00', 'Echo results review',           'Scheduled'),
(24, 3,  3, DATE_ADD(CURDATE(), INTERVAL 2 DAY),  '09:30', 'Post-op knee review',           'Scheduled'),
(25, 5,  2, DATE_ADD(CURDATE(), INTERVAL 2 DAY),  '11:00', 'Cardiology referral – HTN',     'Scheduled'),
(26, 7,  1, DATE_ADD(CURDATE(), INTERVAL 3 DAY),  '09:00', 'HbA1c results',                 'Scheduled'),
(27, 20, 2, DATE_ADD(CURDATE(), INTERVAL 3 DAY),  '14:00', 'Chest pain evaluation',         'Scheduled'),
(28, 11, 2, DATE_ADD(CURDATE(), INTERVAL 5 DAY),  '09:00', 'Warfarin INR check',            'Scheduled'),
(29, 15, 2, DATE_ADD(CURDATE(), INTERVAL 5 DAY),  '10:30', 'Cardiology consult',            'Scheduled'),
(30, 4,  6, DATE_ADD(CURDATE(), INTERVAL 7 DAY),  '11:00', 'Follow-up OB-GYN',              'Scheduled');

-- ============================================================
-- 16. MEDICAL RECORDS  (17 records for completed appointments)
-- ============================================================
INSERT INTO medical_records
  (record_id, patient_id, doctor_id, appointment_id, visit_date,
   chief_complaint, diagnosis, treatment_plan,
   blood_pressure, heart_rate, temperature, weight_kg, height_cm, oxygen_sat) VALUES
(1,  1,  1, 1,  DATE_SUB(CURDATE(),INTERVAL 30 DAY), 'Persistent cough 2 weeks, mild fever',
    'Acute upper respiratory tract infection', 'Azithromycin 500mg 3 days, Paracetamol SOS, rest',
    '118/76', 88, 37.8, 72.0, 175.0, 97),
(2,  2,  2, 2,  DATE_SUB(CURDATE(),INTERVAL 28 DAY), 'Chest pain on exertion, left arm heaviness',
    'Stable angina – further workup needed', 'ECG ordered, Aspirin 75mg, Atorvastatin 10mg, restrict activity',
    '142/92', 78, 36.6, 65.0, 162.0, 99),
(3,  3,  3, 3,  DATE_SUB(CURDATE(),INTERVAL 25 DAY), 'Right knee swelling and pain for 1 month',
    'Right knee osteoarthritis Grade II', 'Diclofenac 50mg BD, physiotherapy referral, knee X-ray',
    '130/84', 72, 36.5, 88.0, 170.0, 98),
(4,  4,  6, 4,  DATE_SUB(CURDATE(),INTERVAL 22 DAY), 'Missed period, nausea, fatigue',
    'Pregnancy confirmed – approximately 8 weeks', 'Folic acid 5mg, Iron 100mg, OB-GYN follow-up in 4 weeks',
    '110/70', 80, 36.4, 55.0, 158.0, 99),
(5,  5,  1, 5,  DATE_SUB(CURDATE(),INTERVAL 20 DAY), 'Headache, BP readings high at home',
    'Stage 2 hypertension, poorly controlled', 'Amlodipine 5mg increased to 10mg, Losartan 50mg added, salt restriction',
    '168/102',84, 36.7, 82.0, 168.0, 97),
(6,  6,  2, 6,  DATE_SUB(CURDATE(),INTERVAL 18 DAY), 'Heart racing episodes, dizziness',
    'Paroxysmal supraventricular tachycardia (PSVT)', 'Metoprolol 50mg BD, Holter monitor, avoid caffeine',
    '124/78', 96, 36.6, 58.0, 163.0, 98),
(7,  7,  1, 7,  DATE_SUB(CURDATE(),INTERVAL 15 DAY), 'High sugar readings, increased thirst',
    'Type 2 diabetes mellitus – suboptimal control', 'Metformin 500mg increased to 1g BD, HbA1c ordered, diabetic diet advice',
    '128/82', 76, 36.5, 90.0, 172.0, 98),
(8,  8,  7, 8,  DATE_SUB(CURDATE(),INTERVAL 14 DAY), 'Fever 3 days, runny nose, sore throat',
    'Viral upper respiratory infection', 'Paracetamol 250mg TDS, plenty of fluids, return if not improving in 3 days',
    '98/64',  102,38.2, 38.0, 148.0, 97),
(9,  9,  3, 9,  DATE_SUB(CURDATE(),INTERVAL 12 DAY), 'Chronic lower back pain worsening',
    'Lumbar disc disease L4-L5', 'Diclofenac 50mg, physiotherapy, MRI lumbar spine ordered',
    '126/80', 74, 36.4, 78.0, 178.0, 98),
(10, 10, 6, 10, DATE_SUB(CURDATE(),INTERVAL 10 DAY), 'Routine antenatal visit, 24 weeks',
    'Normal pregnancy 24 weeks, mild anaemia', 'Iron 200mg BD, folic acid, Calcium + Vit D, repeat blood work',
    '108/68', 82, 36.5, 67.0, 160.0, 99),
(11, 11, 2, 11, DATE_SUB(CURDATE(),INTERVAL  8 DAY), 'Follow-up post PTCA, chest tightness occasional',
    'Post-PTCA stable, anticoagulation review', 'Continue Warfarin, Clopidogrel, Aspirin; PT/INR check, echo ordered',
    '136/84', 68, 36.6, 74.0, 167.0, 98),
(12, 12, 1, 12, DATE_SUB(CURDATE(),INTERVAL  7 DAY), 'Generalised weakness, poor appetite, weight loss 3kg',
    'Iron deficiency anaemia, possible hypothyroidism', 'CBC, TFT ordered; Iron 100mg, Folic acid, high protein diet',
    '112/72', 86, 36.3, 52.0, 155.0, 96),
(13, 13, 7, 13, DATE_SUB(CURDATE(),INTERVAL  6 DAY), 'Ear pain and discharge for 5 days',
    'Acute otitis media right ear', 'Amoxicillin 250mg TDS for 7 days, ear drops, keep ear dry',
    '96/62',  108,37.6, 22.0, 118.0, 98),
(14, 14, 9, 14, DATE_SUB(CURDATE(),INTERVAL  5 DAY), 'Annual health screening, no complaints',
    'Healthy adult, minor Vit D deficiency', 'Calcium + Vit D supplementation, repeat lipid panel in 6 months',
    '116/74', 70, 36.5, 60.0, 164.0, 99),
(15, 15, 1, 15, DATE_SUB(CURDATE(),INTERVAL  4 DAY), 'Exertional dyspnoea, ankle swelling',
    'Congestive cardiac failure – moderate', 'Furosemide 40mg OD, Enalapril 5mg, fluid restriction 1.5L/day; cardiology referral',
    '148/94', 92, 36.7, 76.0, 166.0, 94),
(16, 16, 9, 16, DATE_SUB(CURDATE(),INTERVAL  3 DAY), 'Burning epigastric pain after meals',
    'Gastro-oesophageal reflux disease (GORD)', 'Omeprazole 20mg BD, avoid spicy food, small meals',
    '122/80', 74, 36.5, 80.0, 174.0, 98),
(17, 17, 10,17, DATE_SUB(CURDATE(),INTERVAL  2 DAY), 'Routine hypertension follow-up',
    'Hypertension well-controlled on medication', 'Continue Amlodipine 5mg, Losartan 50mg; review in 3 months',
    '128/80', 72, 36.4, 71.0, 162.0, 99);


-- ============================================================
-- 17. PRESCRIPTIONS + ITEMS
-- ============================================================
INSERT INTO prescriptions (prescription_id, record_id, patient_id, doctor_id, prescribed_date, valid_till) VALUES
(1,  1,  1,  1,  DATE_SUB(CURDATE(),INTERVAL 30 DAY), DATE_SUB(CURDATE(),INTERVAL 20 DAY)),
(2,  2,  2,  2,  DATE_SUB(CURDATE(),INTERVAL 28 DAY), DATE_ADD(CURDATE(),INTERVAL 60 DAY)),
(3,  3,  3,  3,  DATE_SUB(CURDATE(),INTERVAL 25 DAY), DATE_ADD(CURDATE(),INTERVAL 30 DAY)),
(4,  4,  4,  6,  DATE_SUB(CURDATE(),INTERVAL 22 DAY), DATE_ADD(CURDATE(),INTERVAL 90 DAY)),
(5,  5,  5,  1,  DATE_SUB(CURDATE(),INTERVAL 20 DAY), DATE_ADD(CURDATE(),INTERVAL 90 DAY)),
(6,  6,  6,  2,  DATE_SUB(CURDATE(),INTERVAL 18 DAY), DATE_ADD(CURDATE(),INTERVAL 60 DAY)),
(7,  7,  7,  1,  DATE_SUB(CURDATE(),INTERVAL 15 DAY), DATE_ADD(CURDATE(),INTERVAL 90 DAY)),
(8,  8,  8,  7,  DATE_SUB(CURDATE(),INTERVAL 14 DAY), DATE_SUB(CURDATE(),INTERVAL  7 DAY)),
(9,  9,  9,  3,  DATE_SUB(CURDATE(),INTERVAL 12 DAY), DATE_ADD(CURDATE(),INTERVAL 30 DAY)),
(10, 10, 10, 6,  DATE_SUB(CURDATE(),INTERVAL 10 DAY), DATE_ADD(CURDATE(),INTERVAL 180 DAY)),
(11, 11, 11, 2,  DATE_SUB(CURDATE(),INTERVAL  8 DAY), DATE_ADD(CURDATE(),INTERVAL 90 DAY)),
(12, 12, 12, 1,  DATE_SUB(CURDATE(),INTERVAL  7 DAY), DATE_ADD(CURDATE(),INTERVAL 60 DAY)),
(13, 13, 13, 7,  DATE_SUB(CURDATE(),INTERVAL  6 DAY), DATE_SUB(CURDATE(),INTERVAL 0 DAY)),
(14, 15, 15, 1,  DATE_SUB(CURDATE(),INTERVAL  4 DAY), DATE_ADD(CURDATE(),INTERVAL 90 DAY)),
(15, 16, 16, 9,  DATE_SUB(CURDATE(),INTERVAL  3 DAY), DATE_ADD(CURDATE(),INTERVAL 60 DAY));

INSERT INTO prescription_items
  (prescription_id, medicine_id, dosage, frequency, duration_days, quantity, instructions) VALUES
-- Presc 1: URTI (Aarav)
(1, 12, '500mg', 'Once daily', 3,  3, 'Take with food'),
(1,  1, '500mg', 'As needed',  5, 10, 'Max 3 times/day'),
-- Presc 2: Angina (Priya)
(2,  9,  '75mg', 'Once daily', 90, 90, 'Take after breakfast'),
(2,  3,  '10mg', 'Once daily', 90, 90, 'Take at night'),
-- Presc 3: Osteoarthritis (Sanjay)
(3, 13,  '50mg', 'Twice daily',30, 60, 'Take after meals'),
-- Presc 4: Pregnancy (Meena)
(4, 17,   '5mg', 'Once daily', 90, 90, 'Take at the same time daily'),
(4, 16, '100mg', 'Once daily', 90, 90, 'Take on empty stomach'),
-- Presc 5: Hypertension (Binod)
(5,  6,  '10mg', 'Once daily', 90, 90, 'Take in the morning'),
(5, 21,  '50mg', 'Once daily', 90, 90, 'Take in the evening'),
-- Presc 6: PSVT (Gita)
(6,  7,  '50mg', 'Twice daily',60, 120,'Take with water'),
-- Presc 7: Diabetes (Suresh)
(7,  4, '1000mg','Twice daily',90, 180,'Take with meals'),
-- Presc 8: Paediatric URTI (Sabina)
(8,  1, '250mg', 'Three times daily', 5, 15, 'Crush tablet if needed'),
-- Presc 9: Back pain (Dipesh)
(9, 13,  '50mg', 'Twice daily',14, 28, 'Take after food'),
-- Presc 10: Pregnancy (Anjali)
(10,16, '200mg', 'Twice daily',180,360,'Take on empty stomach'),
(10,17,  '5mg',  'Once daily', 180,180,'Take daily'),
(10,15,  '1 tab','Once daily', 180,180,'Take with meals'),
-- Presc 11: Post-PTCA (Krishna)
(11,23,  '5mg',  'Once daily', 90, 90, 'Check INR fortnightly'),
(11, 8,  '75mg', 'Once daily', 90, 90, 'Do not stop without doctor advice'),
(11, 9,  '75mg', 'Once daily', 90, 90, 'Take after breakfast'),
-- Presc 12: Anaemia (Lakshmi)
(12,16, '100mg', 'Once daily', 60, 60, 'Take on empty stomach'),
(12,17,  '5mg',  'Once daily', 60, 60, 'Take daily'),
-- Presc 13: Otitis media child (Rohan)
(13, 2, '250mg', 'Three times daily', 7, 21, 'Complete full course'),
-- Presc 14: Cardiac failure (Prakash)
(14,24,  '40mg', 'Once daily', 90, 90, 'Take in the morning'),
-- Presc 15: GORD (Suman)
(15, 5,  '20mg', 'Twice daily',60, 120,'Take 30 min before meals');


-- ============================================================
-- 18. LAB RESULTS
-- ============================================================
INSERT INTO lab_results
  (result_id, patient_id, record_id, test_id, ordered_by,
   ordered_date, result_date, result_value, status, remarks) VALUES
(1,  2,  2,  9,  2, DATE_SUB(CURDATE(),INTERVAL 28 DAY), DATE_SUB(CURDATE(),INTERVAL 27 DAY),
    'Sinus tachycardia, ST depression V4-V6', 'Completed', 'Abnormal – cardiology review required'),
(2,  2,  2,  11, 2, DATE_SUB(CURDATE(),INTERVAL 28 DAY), DATE_SUB(CURDATE(),INTERVAL 25 DAY),
    'EF 48%, regional wall motion abnormality inferior wall', 'Completed', 'Reduced EF – medication adjusted'),
(3,  7,  7,  3,  1, DATE_SUB(CURDATE(),INTERVAL 15 DAY), DATE_SUB(CURDATE(),INTERVAL 12 DAY),
    '8.2%', 'Completed', 'Suboptimal control – target < 7%'),
(4,  7,  7,  2,  1, DATE_SUB(CURDATE(),INTERVAL 15 DAY), DATE_SUB(CURDATE(),INTERVAL 13 DAY),
    '182 mg/dL', 'Completed', 'Elevated – dietary advice given'),
(5,  11, 11, 17, 2, DATE_SUB(CURDATE(),INTERVAL  8 DAY), DATE_SUB(CURDATE(),INTERVAL  7 DAY),
    'INR 2.8', 'Completed', 'Therapeutic range – continue current dose'),
(6,  11, 11, 11, 2, DATE_SUB(CURDATE(),INTERVAL  8 DAY), DATE_SUB(CURDATE(),INTERVAL  5 DAY),
    'EF 42%, dilated LV', 'Completed', 'Further deterioration noted'),
(7,  12, 12, 1,  1, DATE_SUB(CURDATE(),INTERVAL  7 DAY), DATE_SUB(CURDATE(),INTERVAL  6 DAY),
    'Hb 8.2 g/dL, MCV 68 fL, Microcytic hypochromic', 'Completed', 'Moderate iron deficiency anaemia'),
(8,  12, 12, 8,  1, DATE_SUB(CURDATE(),INTERVAL  7 DAY), NULL,
    NULL, 'In Progress', 'Sample sent to lab'),
(9,  15, 15, 9,  1, DATE_SUB(CURDATE(),INTERVAL  4 DAY), DATE_SUB(CURDATE(),INTERVAL  3 DAY),
    'Sinus rhythm, LVH pattern, poor R wave progression', 'Completed', 'Consistent with longstanding hypertension'),
(10, 15, 15, 10, 1, DATE_SUB(CURDATE(),INTERVAL  4 DAY), DATE_SUB(CURDATE(),INTERVAL  3 DAY),
    'Cardiomegaly, bilateral basal effusions', 'Completed', 'Consistent with CCF'),
(11, 5,  5,  4,  1, DATE_SUB(CURDATE(),INTERVAL 20 DAY), DATE_SUB(CURDATE(),INTERVAL 18 DAY),
    'Total cholesterol 228 mg/dL, LDL 148, HDL 38, TG 210', 'Completed', 'Dyslipidaemia – statin started'),
(12, 3,  3,  10, 3, DATE_SUB(CURDATE(),INTERVAL 25 DAY), DATE_SUB(CURDATE(),INTERVAL 24 DAY),
    'Medial joint space narrowing right knee, osteophytes', 'Completed', 'Consistent with OA Grade II'),
(13, 9,  9,  10, 3, DATE_SUB(CURDATE(),INTERVAL 12 DAY), DATE_SUB(CURDATE(),INTERVAL 11 DAY),
    'Reduced L4-L5 disc height, no cord compression', 'Completed', 'MRI recommended for further evaluation'),
(14, 10, 10, 1,  6, DATE_SUB(CURDATE(),INTERVAL 10 DAY), DATE_SUB(CURDATE(),INTERVAL  9 DAY),
    'Hb 10.4 g/dL, WBC 9.2, Platelets 224', 'Completed', 'Mild anaemia of pregnancy'),
(15, 14, 14, 4,  9, DATE_SUB(CURDATE(),INTERVAL  5 DAY), NULL,
    NULL, 'Ordered', 'Baseline lipid screen'),
(16, 6,  6,  9,  2, DATE_SUB(CURDATE(),INTERVAL 18 DAY), DATE_SUB(CURDATE(),INTERVAL 17 DAY),
    'Paroxysmal SVT captured, HR 188 bpm during episode', 'Completed', 'Confirmed PSVT');


-- ============================================================
-- 19. ADMISSIONS  (8 active + 3 discharged)
-- ============================================================
-- Active admissions (bed_ids matching Occupied beds above)
-- bed_id mapping: room1=(1-6), room2=(7-12), room3=(13-18),
--   room4=(19-20), room5=(21-22), room6=(23), room7=(24),
--   room8=(25), room9=(26-29), room10=(30-33), room11=(34-35), room13=(38-41)

INSERT INTO admissions
  (admission_id, patient_id, bed_id, admitting_doctor_id, admitted_by,
   admission_date, expected_discharge, admission_reason, visit_type, status) VALUES
-- Active
(1,  15, 1,  1, 1, DATE_SUB(CURDATE(),INTERVAL  3 DAY), DATE_ADD(CURDATE(),INTERVAL 4 DAY),
    'Decompensated congestive cardiac failure, respiratory distress', 'Emergency', 'Active'),
(2,  5,  2,  2, 1, DATE_SUB(CURDATE(),INTERVAL  5 DAY), DATE_ADD(CURDATE(),INTERVAL 2 DAY),
    'Hypertensive crisis, BP 210/120 on admission', 'Emergency', 'Active'),
(3,  11, 26, 2, 2, DATE_SUB(CURDATE(),INTERVAL  8 DAY), DATE_ADD(CURDATE(),INTERVAL 1 DAY),
    'Acute coronary syndrome – post PTCA monitoring', 'Planned', 'Active'),
(4,  20, 30, 2, 1, DATE_SUB(CURDATE(),INTERVAL  2 DAY), DATE_ADD(CURDATE(),INTERVAL 5 DAY),
    'Severe chest pain, STEMI confirmed on ECG', 'Emergency', 'Active'),
(5,  10, 34, 6, 2, DATE_SUB(CURDATE(),INTERVAL  1 DAY), DATE_ADD(CURDATE(),INTERVAL 3 DAY),
    'Preterm labour at 32 weeks, monitoring required', 'Emergency', 'Active'),
(6,  4,  25, 6, 2, DATE_SUB(CURDATE(),INTERVAL  4 DAY), DATE_ADD(CURDATE(),INTERVAL 2 DAY),
    'Severe hyperemesis gravidarum, IV fluids required', 'Planned', 'Active'),
(7,  13, 38, 7, 1, DATE_SUB(CURDATE(),INTERVAL  2 DAY), DATE_ADD(CURDATE(),INTERVAL 3 DAY),
    'Acute febrile illness, dengue suspected', 'Emergency', 'Active'),
(8,  3,  5,  3, 2, DATE_SUB(CURDATE(),INTERVAL  6 DAY), DATE_ADD(CURDATE(),INTERVAL 1 DAY),
    'Total knee replacement surgery', 'Planned', 'Active'),
-- Discharged
(9,  1,  3,  1, 1, DATE_SUB(CURDATE(),INTERVAL 20 DAY), DATE_SUB(CURDATE(),INTERVAL 16 DAY),
    'Severe pneumonia requiring IV antibiotics', 'Emergency', 'Discharged'),
(10, 8,  7,  7, 2, DATE_SUB(CURDATE(),INTERVAL 10 DAY), DATE_SUB(CURDATE(),INTERVAL  8 DAY),
    'High fever, febrile seizure – paediatric observation', 'Emergency', 'Discharged'),
(11, 17, 19, 10,1, DATE_SUB(CURDATE(),INTERVAL 15 DAY), DATE_SUB(CURDATE(),INTERVAL 12 DAY),
    'Hypertensive emergency with end-organ damage signs', 'Emergency', 'Discharged');

-- Update actual discharge dates for discharged patients
UPDATE admissions SET actual_discharge = DATE_SUB(CURDATE(),INTERVAL 16 DAY),
    discharge_summary = 'Recovered from pneumonia. Discharged on oral Amoxicillin. Follow-up in 1 week.'
WHERE admission_id = 9;

UPDATE admissions SET actual_discharge = DATE_SUB(CURDATE(),INTERVAL  8 DAY),
    discharge_summary = 'Fever settled, no recurrent seizures. Discharged with antipyretics and neurology referral.'
WHERE admission_id = 10;

UPDATE admissions SET actual_discharge = DATE_SUB(CURDATE(),INTERVAL 12 DAY),
    discharge_summary = 'BP controlled on Amlodipine + Losartan. Renal function normal on discharge.'
WHERE admission_id = 11;

-- Mark discharged beds as Available (beds 3, 7, 19)
UPDATE beds SET status = 'Available' WHERE bed_id IN (3, 7, 19);


-- ============================================================
-- 20. WAITING LIST  (3 entries)
-- ============================================================
INSERT INTO admission_waiting_list
  (patient_id, doctor_id, handled_by, room_type_id, visit_type, priority, reason, status) VALUES
(2,  2, 1, 4, 'Planned',   3, 'Post-PTCA monitoring, ICU bed requested', 'Waiting'),
(18, 7, 2, 6, 'Emergency', 1, 'Child with high fever and febrile convulsion – paediatric ward needed', 'Waiting'),
(16, 1, 1, 1, 'Planned',   5, 'Elective colonoscopy prep, general ward needed overnight', 'Waiting');


-- ============================================================
-- 21. BILLS  (one per completed outpatient appointment + admitted patients)
-- ============================================================
INSERT INTO bills
  (bill_id, patient_id, appointment_id, admission_id, bill_date, due_date,
   subtotal, discount_pct, tax_pct, total_amount, amount_paid, status) VALUES
-- Outpatient completed bills
(1,  1,  1,  NULL, DATE_SUB(CURDATE(),INTERVAL 30 DAY), DATE_SUB(CURDATE(),INTERVAL  0 DAY), 1050.00, 0,  13, 1186.50,  1186.50, 'Paid'),
(2,  2,  2,  NULL, DATE_SUB(CURDATE(),INTERVAL 28 DAY), DATE_ADD(CURDATE(),INTERVAL 30 DAY), 3350.00, 0,  13, 3785.50,  2000.00, 'Partially Paid'),
(3,  3,  3,  NULL, DATE_SUB(CURDATE(),INTERVAL 25 DAY), DATE_ADD(CURDATE(),INTERVAL  5 DAY), 2300.00, 0,  13, 2599.00,  2599.00, 'Paid'),
(4,  4,  4,  NULL, DATE_SUB(CURDATE(),INTERVAL 22 DAY), DATE_ADD(CURDATE(),INTERVAL  8 DAY), 1400.00, 5,  13, 1499.10,  1499.10, 'Paid'),
(5,  5,  5,  NULL, DATE_SUB(CURDATE(),INTERVAL 20 DAY), DATE_ADD(CURDATE(),INTERVAL 10 DAY), 1150.00, 0,  13, 1299.50,  1299.50, 'Paid'),
(6,  7,  7,  NULL, DATE_SUB(CURDATE(),INTERVAL 15 DAY), DATE_ADD(CURDATE(),INTERVAL 15 DAY),  600.00, 0,  13,  678.00,     0.00, 'Issued'),
(7,  11, 11, NULL, DATE_SUB(CURDATE(),INTERVAL  8 DAY), DATE_ADD(CURDATE(),INTERVAL 22 DAY), 6700.00, 0,  13, 7571.00,  5000.00, 'Partially Paid'),
(8,  15, 15, NULL, DATE_SUB(CURDATE(),INTERVAL  4 DAY), DATE_ADD(CURDATE(),INTERVAL 26 DAY), 2100.00, 0,  13, 2373.00,     0.00, 'Issued'),
-- Inpatient bills (draft — will be finalised on discharge)
(9,  15, NULL, 1,  DATE_SUB(CURDATE(),INTERVAL  3 DAY), DATE_ADD(CURDATE(),INTERVAL 34 DAY),  500.00, 0,  13,  565.00,     0.00, 'Draft'),
(10, 5,  NULL, 2,  DATE_SUB(CURDATE(),INTERVAL  5 DAY), DATE_ADD(CURDATE(),INTERVAL 32 DAY), 2500.00, 0,  13, 2825.00,     0.00, 'Draft'),
(11, 1,  NULL, 9,  DATE_SUB(CURDATE(),INTERVAL 16 DAY), DATE_SUB(CURDATE(),INTERVAL  1 DAY), 4500.00, 0,  13, 5085.00,  5085.00, 'Paid');


-- ============================================================
-- 22. BILL ITEMS
-- ============================================================
INSERT INTO bill_items (bill_id, item_type, description, quantity, unit_price) VALUES
-- Bill 1: Aarav URTI
(1, 'Consultation', 'Dr. Ramesh Sharma – General Physician', 1, 600.00),
(1, 'Lab Test',     'Complete Blood Count (CBC)', 1, 350.00),
(1, 'Medicine',     'Azithromycin 500mg x3', 3, 45.00),
(1, 'Medicine',     'Paracetamol 500mg x10', 10, 5.00),
-- Bill 2: Priya cardiac
(2, 'Consultation', 'Dr. Sunita Thapa – Cardiologist', 1, 1800.00),
(2, 'Lab Test',     'Electrocardiogram (ECG)', 1, 500.00),
(2, 'Lab Test',     'Echocardiogram', 1, 3500.00),
-- Bill 3: Sanjay knee
(3, 'Consultation', 'Dr. Bikash Acharya – Orthopaedic Surgeon', 1, 1500.00),
(3, 'Lab Test',     'Chest X-Ray', 1, 800.00),
-- Bill 4: Meena OB-GYN
(4, 'Consultation', 'Dr. Anupama Joshi – Gynaecologist', 1, 1400.00),
-- Bill 5: Binod hypertension
(5, 'Consultation', 'Dr. Ramesh Sharma – General Physician', 1, 600.00),
(5, 'Lab Test',     'Lipid Profile', 1, 550.00),
-- Bill 6: Suresh diabetes
(6, 'Consultation', 'Dr. Ramesh Sharma – General Physician', 1, 600.00),
-- Bill 7: Krishna post-PTCA
(7, 'Consultation', 'Dr. Sunita Thapa – Cardiologist', 1, 1800.00),
(7, 'Lab Test',     'Echocardiogram', 1, 3500.00),
(7, 'Lab Test',     'Prothrombin Time (PT/INR)', 1, 400.00),
-- Bill 8: Prakash CCF
(8, 'Consultation', 'Dr. Ramesh Sharma – General Physician', 1, 600.00),
(8, 'Lab Test',     'Electrocardiogram (ECG)', 1, 500.00),
(8, 'Lab Test',     'Chest X-Ray', 1, 800.00),
-- Bill 9: Prakash inpatient (partial — admission ongoing)
(9, 'Room', 'General Ward GW-101 Bed A – 3 days', 3, 500.00),
-- Bill 10: Binod inpatient
(10,'Room', 'Semi-Private SP-201 Bed A – 5 days', 5, 1200.00),
-- Bill 11: Aarav pneumonia discharge
(11,'Room', 'General Ward GW-103 Bed A – 4 days', 4, 500.00),
(11,'Consultation','Dr. Ramesh Sharma – Inpatient daily', 4, 600.00),
(11,'Medicine',    'IV Amoxicillin course',              1, 300.00);


-- ============================================================
-- 23. PAYMENTS
-- ============================================================
INSERT INTO payments (bill_id, payment_date, amount, method, reference_no, received_by) VALUES
(1,  DATE_SUB(CURDATE(),INTERVAL 30 DAY), 1186.50, 'Cash',           NULL,          1),
(2,  DATE_SUB(CURDATE(),INTERVAL 28 DAY), 2000.00, 'Card',           'TXN-CC-0281', 1),
(3,  DATE_SUB(CURDATE(),INTERVAL 25 DAY), 2599.00, 'Mobile Payment', 'ESEWA-34521', 2),
(4,  DATE_SUB(CURDATE(),INTERVAL 22 DAY), 1499.10, 'Cash',           NULL,          1),
(5,  DATE_SUB(CURDATE(),INTERVAL 20 DAY), 1299.50, 'Bank Transfer',  'TXN-BNK-991', 2),
(7,  DATE_SUB(CURDATE(),INTERVAL  8 DAY), 5000.00, 'Card',           'TXN-CC-0892', 1),
(11, DATE_SUB(CURDATE(),INTERVAL 16 DAY), 5085.00, 'Cash',           NULL,          2);



-- ============================================================
-- RECREATE ALL TRIGGERS
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_no_past_appointments
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
    IF NEW.appointment_date < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot book an appointment in the past.';
    END IF;
END$$

CREATE TRIGGER trg_complete_appointment
AFTER INSERT ON medical_records
FOR EACH ROW
BEGIN
    IF NEW.appointment_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'Completed'
        WHERE appointment_id = NEW.appointment_id;
    END IF;
END$$

CREATE TRIGGER trg_deduct_stock
AFTER INSERT ON prescription_items
FOR EACH ROW
BEGIN
    UPDATE medicine_stock
    SET quantity = GREATEST(quantity - NEW.quantity, 0)
    WHERE medicine_id = NEW.medicine_id;
END$$

CREATE TRIGGER trg_payment_status
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE v_total DECIMAL(12,2);
    DECLARE v_paid  DECIMAL(12,2);
    SELECT total_amount, amount_paid INTO v_total, v_paid
    FROM bills WHERE bill_id = NEW.bill_id;
    IF v_paid >= v_total THEN
        UPDATE bills SET status = 'Paid' WHERE bill_id = NEW.bill_id;
    END IF;
END$$

CREATE TRIGGER trg_check_bed_on_admit
BEFORE INSERT ON admissions
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(30);
    SELECT status INTO v_status FROM beds WHERE bed_id = NEW.bed_id;
    IF v_status != 'Available' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Bed is not available for admission.';
    END IF;
END$$

CREATE TRIGGER trg_release_waiting_list
AFTER UPDATE ON beds
FOR EACH ROW
BEGIN
    DECLARE v_room_type_id INT UNSIGNED;
    DECLARE v_waiting_id   INT UNSIGNED;
    IF NEW.status = 'Available' AND OLD.status = 'Occupied' THEN
        SELECT r.room_type_id INTO v_room_type_id
        FROM rooms r JOIN beds b ON b.room_id = r.room_id
        WHERE b.bed_id = NEW.bed_id;
        SELECT waiting_id INTO v_waiting_id
        FROM admission_waiting_list
        WHERE room_type_id = v_room_type_id AND status = 'Waiting'
        ORDER BY priority ASC, requested_at ASC
        LIMIT 1;
        IF v_waiting_id IS NOT NULL THEN
            UPDATE admission_waiting_list
            SET notes = CONCAT(COALESCE(notes,''), ' | Bed #', NEW.bed_id,
                        ' available as of ', NOW(), ' — pending receptionist confirmation.')
            WHERE waiting_id = v_waiting_id;
        END IF;
    END IF;
END$$

DELIMITER ;


-- FINAL CHECKS
-- ============================================================
SELECT 'departments'          AS tbl, COUNT(*) AS row_count FROM departments
UNION ALL SELECT 'doctors',             COUNT(*) FROM doctors
UNION ALL SELECT 'staff',               COUNT(*) FROM staff
UNION ALL SELECT 'patients',            COUNT(*) FROM patients
UNION ALL SELECT 'rooms',               COUNT(*) FROM rooms
UNION ALL SELECT 'beds',                COUNT(*) FROM beds
UNION ALL SELECT 'medicines',           COUNT(*) FROM medicines
UNION ALL SELECT 'lab_tests',           COUNT(*) FROM lab_tests
UNION ALL SELECT 'appointments',        COUNT(*) FROM appointments
UNION ALL SELECT 'medical_records',     COUNT(*) FROM medical_records
UNION ALL SELECT 'prescriptions',       COUNT(*) FROM prescriptions
UNION ALL SELECT 'prescription_items',  COUNT(*) FROM prescription_items
UNION ALL SELECT 'lab_results',         COUNT(*) FROM lab_results
UNION ALL SELECT 'admissions',          COUNT(*) FROM admissions
UNION ALL SELECT 'waiting_list',        COUNT(*) FROM admission_waiting_list
UNION ALL SELECT 'bills',               COUNT(*) FROM bills
UNION ALL SELECT 'bill_items',          COUNT(*) FROM bill_items
UNION ALL SELECT 'payments',            COUNT(*) FROM payments;

-- ============================================================
--   END OF SEED DATA
-- ============================================================