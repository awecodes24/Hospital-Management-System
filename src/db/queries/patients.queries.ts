import { query, queryOne } from '../pool';
import { PatientRow } from '../../types/db.types';

// ── List & Search ─────────────────────────────────────────────

export async function getAllPatients(limit: number, offset: number) {
  const l = Math.abs(Math.trunc(limit));
  const o = Math.abs(Math.trunc(offset));
  return query<PatientRow & { age: number; total_visits: number }>(
    `SELECT
       p.*,
       TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
       COUNT(DISTINCT a.appointment_id)                AS total_visits
     FROM patients p
     LEFT JOIN appointments a ON p.patient_id = a.patient_id
     GROUP BY p.patient_id
     ORDER BY p.created_at DESC
     LIMIT ${l} OFFSET ${o}`,
    [],
  );
}

export async function countPatients(): Promise<number> {
  const rows = await query<{ total: number }>('SELECT COUNT(*) AS total FROM patients');
  return rows[0].total;
}

export async function searchPatients(term: string, limit: number, offset: number) {
  const like = `%${term}%`;
  const l = Math.abs(Math.trunc(limit));
  const o = Math.abs(Math.trunc(offset));
  return query<PatientRow & { age: number }>(
    `SELECT p.*,
            TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age
     FROM patients p
     WHERE p.first_name  LIKE ?
        OR p.last_name   LIKE ?
        OR p.phone       LIKE ?
        OR p.email       LIKE ?
     ORDER BY p.last_name, p.first_name
     LIMIT ${l} OFFSET ${o}`,
    [like, like, like, like],
  );
}

export async function countSearchPatients(term: string): Promise<number> {
  const like = `%${term}%`;
  const rows = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM patients
     WHERE first_name LIKE ? OR last_name LIKE ?
        OR phone      LIKE ? OR email    LIKE ?`,
    [like, like, like, like],
  );
  return rows[0].total;
}

// ── Single Patient ────────────────────────────────────────────

export async function getPatientById(patientId: number) {
  return queryOne<PatientRow & { age: number }>(
    `SELECT p.*,
            TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age
     FROM patients p
     WHERE p.patient_id = ?`,
    [patientId],
  );
}

export async function getPatientByPhone(phone: string) {
  return queryOne<PatientRow>(
    'SELECT * FROM patients WHERE phone = ?',
    [phone],
  );
}

export async function getPatientByEmail(email: string) {
  return queryOne<PatientRow>(
    'SELECT * FROM patients WHERE email = ?',
    [email],
  );
}

// ── Create / Update ───────────────────────────────────────────

export interface CreatePatientData {
  first_name:              string;
  last_name:               string;
  date_of_birth:           string;
  gender:                  'Male' | 'Female' | 'Other';
  blood_group?:            string;
  email?:                  string;
  phone:                   string;
  address?:                string;
  emergency_contact_name?: string;
  emergency_contact_phone?:string;
  allergies?:              string;
}

export async function createPatient(data: CreatePatientData): Promise<number> {
  const rows = await query<{ insertId: number }>(
    `INSERT INTO patients
       (first_name, last_name, date_of_birth, gender, blood_group,
        email, phone, address,
        emergency_contact_name, emergency_contact_phone, allergies)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.first_name, data.last_name, data.date_of_birth,
      data.gender, data.blood_group ?? null, data.email ?? null,
      data.phone, data.address ?? null,
      data.emergency_contact_name ?? null,
      data.emergency_contact_phone ?? null,
      data.allergies ?? null,
    ],
  );
  // mysql2 returns OkPacket with insertId
  const ok = rows as unknown as { insertId: number };
  return ok.insertId;
}

export interface UpdatePatientData {
  first_name?:              string;
  last_name?:               string;
  date_of_birth?:           string;
  gender?:                  'Male' | 'Female' | 'Other';
  blood_group?:             string | null;
  email?:                   string | null;
  phone?:                   string;
  address?:                 string | null;
  emergency_contact_name?:  string | null;
  emergency_contact_phone?: string | null;
  allergies?:               string | null;
}

export async function updatePatient(
  patientId: number,
  data: UpdatePatientData,
): Promise<void> {
  // Build SET clause dynamically from provided fields
  const fields: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    first_name:               data.first_name,
    last_name:                data.last_name,
    date_of_birth:            data.date_of_birth,
    gender:                   data.gender,
    blood_group:              data.blood_group,
    email:                    data.email,
    phone:                    data.phone,
    address:                  data.address,
    emergency_contact_name:   data.emergency_contact_name,
    emergency_contact_phone:  data.emergency_contact_phone,
    allergies:                data.allergies,
  };

  for (const [col, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) return;

  values.push(patientId);
  await query(
    `UPDATE patients SET ${fields.join(', ')} WHERE patient_id = ?`,
    values as Parameters<typeof query>[1],
  );
}

// ── Patient History (quick summary) ──────────────────────────

export async function getPatientSummary(patientId: number) {
  return queryOne<{
    patient_id:          number;
    full_name:           string;
    age:                 number;
    gender:              string;
    blood_group:         string | null;
    phone:               string;
    allergies:           string | null;
    total_appointments:  number;
    total_admissions:    number;
    last_appointment:    Date | null;
  }>(
    `SELECT
       p.patient_id,
       CONCAT(p.first_name, ' ', p.last_name) AS full_name,
       TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
       p.gender, p.blood_group, p.phone, p.allergies,
       COUNT(DISTINCT a.appointment_id)  AS total_appointments,
       COUNT(DISTINCT adm.admission_id)  AS total_admissions,
       MAX(a.appointment_date)           AS last_appointment
     FROM patients p
     LEFT JOIN appointments a   ON p.patient_id = a.patient_id
     LEFT JOIN admissions   adm ON p.patient_id = adm.patient_id
     WHERE p.patient_id = ?
     GROUP BY p.patient_id`,
    [patientId],
  );
}

export async function getPatientAppointments(patientId: number) {
  return query<{
    appointment_id:   number;
    appointment_date: Date;
    appointment_time: string;
    doctor:           string;
    specialization:   string | null;
    reason:           string | null;
    status:           string;
  }>(
    `SELECT
       a.appointment_id,
       a.appointment_date,
       a.appointment_time,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor,
       d.specialization,
       a.reason,
       a.status
     FROM appointments a
     JOIN doctors d ON a.doctor_id = d.doctor_id
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC`,
    [patientId],
  );
}

export async function getPatientAdmissions(patientId: number) {
  return query<{
    admission_id:      number;
    visit_type:        string;
    admission_date:    Date;
    actual_discharge:  Date | null;
    length_of_stay:    number;
    room_type:         string;
    room_number:       string;
    bed_number:        string;
    doctor:            string;
    status:            string;
  }>(
    `SELECT
       adm.admission_id,
       adm.visit_type,
       adm.admission_date,
       adm.actual_discharge,
       DATEDIFF(
         COALESCE(adm.actual_discharge, NOW()),
         adm.admission_date
       )                                        AS length_of_stay,
       rt.name                                  AS room_type,
       r.room_number,
       b.bed_number,
       CONCAT(d.first_name, ' ', d.last_name)   AS doctor,
       adm.status
     FROM admissions adm
     JOIN beds       b  ON adm.bed_id              = b.bed_id
     JOIN rooms      r  ON b.room_id               = r.room_id
     JOIN room_types rt ON r.room_type_id          = rt.room_type_id
     JOIN doctors    d  ON adm.admitting_doctor_id = d.doctor_id
     WHERE adm.patient_id = ?
     ORDER BY adm.admission_date DESC`,
    [patientId],
  );
}