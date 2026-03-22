import { query, queryOne, callProc } from '../pool';
import { AppointmentRow } from '../../types/db.types';
import { SpBookAppointmentResult } from '../../types/db.types';

// ── List ──────────────────────────────────────────────────────

export async function getTodaysAppointments() {
  return query<{
    appointment_id:   number;
    appointment_time: string;
    patient_name:     string;
    patient_phone:    string;
    doctor_name:      string;
    specialization:   string | null;
    department:       string | null;
    reason:           string | null;
    status:           string;
  }>('SELECT * FROM vw_todays_appointments', []);
}

export async function getAppointmentsByDate(date: string) {
  return query<AppointmentRow & {
    patient_name: string;
    doctor_name:  string;
    specialization: string | null;
  }>(
    `SELECT
       a.*,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       d.specialization
     FROM appointments a
     JOIN patients p ON a.patient_id = p.patient_id
     JOIN doctors  d ON a.doctor_id  = d.doctor_id
     WHERE a.appointment_date = ?
     ORDER BY a.appointment_time`,
    [date],
  );
}

export async function getUpcomingAppointments(days: number) {
  return query<AppointmentRow & {
    patient_name: string;
    patient_phone: string;
    doctor_name:  string;
    specialization: string | null;
  }>(
    `SELECT
       a.*,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       p.phone                                 AS patient_phone,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       d.specialization
     FROM appointments a
     JOIN patients p ON a.patient_id = p.patient_id
     JOIN doctors  d ON a.doctor_id  = d.doctor_id
     WHERE a.appointment_date BETWEEN CURDATE()
       AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY a.appointment_date, a.appointment_time`,
    [days],
  );
}

// ── Single ────────────────────────────────────────────────────

export async function getAppointmentById(appointmentId: number) {
  return queryOne<AppointmentRow & {
    patient_name:   string;
    patient_phone:  string;
    patient_allergies: string | null;
    doctor_name:    string;
    specialization: string | null;
    department:     string | null;
  }>(
    `SELECT
       a.*,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       p.phone                                 AS patient_phone,
       p.allergies                             AS patient_allergies,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       d.specialization,
       dep.name                                AS department
     FROM appointments a
     JOIN patients     p   ON a.patient_id    = p.patient_id
     JOIN doctors      d   ON a.doctor_id     = d.doctor_id
     LEFT JOIN departments dep ON d.department_id = dep.department_id
     WHERE a.appointment_id = ?`,
    [appointmentId],
  );
}

// ── Doctor availability ───────────────────────────────────────

export async function getDoctorBookedSlots(doctorId: number, date: string) {
  return query<{ appointment_time: string; status: string }>(
    `SELECT appointment_time, status
     FROM appointments
     WHERE doctor_id        = ?
       AND appointment_date = ?
       AND status NOT IN ('Cancelled', 'No-Show')
     ORDER BY appointment_time`,
    [doctorId, date],
  );
}

export async function getDoctorAvailability(doctorId: number) {
  return queryOne<{
    doctor_id:       number;
    doctor_name:     string;
    specialization:  string | null;
    available_days:  string;
    available_from:  string;
    available_to:    string;
    is_active:       boolean;
  }>(
    `SELECT
       d.doctor_id,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       d.specialization,
       d.available_days,
       d.available_from,
       d.available_to,
       d.is_active
     FROM doctors d
     WHERE d.doctor_id = ?`,
    [doctorId],
  );
}

// ── Book (via stored procedure) ───────────────────────────────

export async function bookAppointment(
  patientId: number,
  doctorId:  number,
  date:      string,
  time:      string,
  reason:    string | null,
): Promise<SpBookAppointmentResult> {
  return callProc<SpBookAppointmentResult>(
    'CALL sp_book_appointment(?, ?, ?, ?, ?, @appt_id, @msg)',
    [patientId, doctorId, date, time, reason ?? null],
    'SELECT @appt_id AS appointment_id, @msg AS message',
  );
}

// ── Update status ─────────────────────────────────────────────

export async function updateAppointmentStatus(
  appointmentId: number,
  status: 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-Show',
  notes?: string,
): Promise<void> {
  await query(
    `UPDATE appointments
     SET status = ?, notes = COALESCE(?, notes), updated_at = NOW()
     WHERE appointment_id = ?`,
    [status, notes ?? null, appointmentId],
  );
}
