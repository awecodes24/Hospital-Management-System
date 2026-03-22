import { query, queryOne } from '../pool';
import { DoctorRow, DepartmentRow } from '../../types/db.types';

// ── Doctors ───────────────────────────────────────────────────

export async function getAllDoctors() {
  return query<DoctorRow & { department_name: string | null }>(
    `SELECT d.*,
            dep.name AS department_name
     FROM doctors d
     LEFT JOIN departments dep ON d.department_id = dep.department_id
     WHERE d.is_active = TRUE
     ORDER BY dep.name, d.last_name`,
    [],
  );
}

export async function getDoctorById(doctorId: number) {
  return queryOne<DoctorRow & { department_name: string | null }>(
    `SELECT d.*,
            dep.name AS department_name
     FROM doctors d
     LEFT JOIN departments dep ON d.department_id = dep.department_id
     WHERE d.doctor_id = ?`,
    [doctorId],
  );
}

export async function getDoctorSchedule(doctorId: number) {
  return query<{
    appointment_date: Date;
    appointment_time: string;
    patient_name:     string;
    reason:           string | null;
    status:           string;
  }>(
    `SELECT
       a.appointment_date,
       a.appointment_time,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       a.reason,
       a.status
     FROM appointments a
     JOIN patients p ON a.patient_id = p.patient_id
     WHERE a.doctor_id        = ?
       AND a.appointment_date >= CURDATE()
       AND a.status NOT IN ('Cancelled','No-Show')
     ORDER BY a.appointment_date, a.appointment_time`,
    [doctorId],
  );
}

// ── Departments ───────────────────────────────────────────────

export async function getAllDepartments() {
  return query<DepartmentRow & {
    head_doctor_name: string | null;
    doctor_count:     number;
  }>(
    `SELECT
       dep.*,
       CONCAT(d.first_name, ' ', d.last_name) AS head_doctor_name,
       COUNT(doc.doctor_id)                    AS doctor_count
     FROM departments dep
     LEFT JOIN doctors d   ON dep.head_doctor_id = d.doctor_id
     LEFT JOIN doctors doc ON dep.department_id  = doc.department_id
                           AND doc.is_active = TRUE
     GROUP BY dep.department_id
     ORDER BY dep.name`,
    [],
  );
}

export async function getDepartmentById(departmentId: number) {
  return queryOne<DepartmentRow & { head_doctor_name: string | null }>(
    `SELECT dep.*,
            CONCAT(d.first_name, ' ', d.last_name) AS head_doctor_name
     FROM departments dep
     LEFT JOIN doctors d ON dep.head_doctor_id = d.doctor_id
     WHERE dep.department_id = ?`,
    [departmentId],
  );
}
