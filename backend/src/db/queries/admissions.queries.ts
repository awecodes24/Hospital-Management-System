import { query, queryOne, callProc } from '../pool';
import { AdmissionRow, WaitingListRow } from '../../types/db.types';
import {
  SpAdmitPatientResult,
  SpDischargeAndBillResult,
  SpRegisterPatientResult,
} from '../../types/db.types';

// list

export async function getActiveAdmissions() {
  return query<{
    admission_id:        number;
    visit_type:          string;
    admission_date:      Date;
    expected_discharge:  Date | null;
    days_admitted:       number;
    patient_name:        string;
    patient_phone:       string;
    blood_group:         string | null;
    allergies:           string | null;
    room_type:           string;
    room_number:         string;
    bed_number:          string;
    admitting_doctor:    string;
    admitted_by:         string | null;
  }>(
    `SELECT
       adm.admission_id,
       adm.visit_type,
       adm.admission_date,
       adm.expected_discharge,
       DATEDIFF(CURDATE(), adm.admission_date)          AS days_admitted,
       CONCAT(p.first_name, ' ', p.last_name)           AS patient_name,
       p.phone                                          AS patient_phone,
       p.blood_group,
       p.allergies,
       rt.name                                          AS room_type,
       r.room_number,
       b.bed_number,
       CONCAT(d.first_name, ' ', d.last_name)           AS admitting_doctor,
       CONCAT(s.first_name, ' ', s.last_name)           AS admitted_by
     FROM admissions adm
     JOIN patients   p  ON adm.patient_id          = p.patient_id
     JOIN beds       b  ON adm.bed_id              = b.bed_id
     JOIN rooms      r  ON b.room_id               = r.room_id
     JOIN room_types rt ON r.room_type_id          = rt.room_type_id
     JOIN doctors    d  ON adm.admitting_doctor_id = d.doctor_id
     LEFT JOIN staff s  ON adm.admitted_by         = s.staff_id
     WHERE adm.status = 'Active'
     ORDER BY adm.admission_date`,
    [],
  );
}

export async function getAllAdmissions(limit: number, offset: number) {
  return query<AdmissionRow & {
    patient_name: string;
    doctor_name:  string;
    room_number:  string;
    bed_number:   string;
  }>(
    `SELECT
       adm.*,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       r.room_number,
       b.bed_number
     FROM admissions adm
     JOIN patients p ON adm.patient_id          = p.patient_id
     JOIN doctors  d ON adm.admitting_doctor_id = d.doctor_id
     JOIN beds     b ON adm.bed_id              = b.bed_id
     JOIN rooms    r ON b.room_id               = r.room_id
     ORDER BY adm.admission_date DESC
     LIMIT ${Math.abs(Math.trunc(limit))} OFFSET ${Math.abs(Math.trunc(offset))}`,
    [],
  );
}

export async function countAdmissions(): Promise<number> {
  const rows = await query<{ total: number }>(
    'SELECT COUNT(*) AS total FROM admissions',
  );
  return rows[0].total;
}

// Single

export async function getAdmissionById(admissionId: number) {
  return queryOne<AdmissionRow & {
    patient_name:    string;
    patient_phone:   string;
    blood_group:     string | null;
    allergies:       string | null;
    doctor_name:     string;
    room_type:       string;
    room_number:     string;
    bed_number:      string;
    daily_rate:      number;
  }>(
    `SELECT
       adm.*,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       p.phone                                 AS patient_phone,
       p.blood_group,
       p.allergies,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       rt.name                                 AS room_type,
       r.room_number,
       b.bed_number,
       rt.daily_rate
     FROM admissions adm
     JOIN patients   p  ON adm.patient_id          = p.patient_id
     JOIN doctors    d  ON adm.admitting_doctor_id = d.doctor_id
     JOIN beds       b  ON adm.bed_id              = b.bed_id
     JOIN rooms      r  ON b.room_id               = r.room_id
     JOIN room_types rt ON r.room_type_id          = rt.room_type_id
     WHERE adm.admission_id = ?`,
    [admissionId],
  );
}

// Bed occupancy (view)

export async function getBedOccupancy() {
  return query<{
    room_number:      string;
    room_type:        string;
    department:       string | null;
    floor:            number | null;
    bed_id:           number;
    bed_number:       string;
    bed_status:       string;
    current_patient:  string | null;
    admission_date:   Date | null;
    expected_discharge: Date | null;
    admitting_doctor: string | null;
  }>('SELECT * FROM vw_bed_occupancy', []);
}

export async function getAvailableBeds() {
  return query<{
    bed_id:       number;
    bed_number:   string;
    room_id:      number;
    room_number:  string;
    floor:        number | null;
    room_type_id: number;
    room_type:    string;
    daily_rate:   number;
    department:   string | null;
  }>('SELECT * FROM vw_available_beds', []);
}

export async function getOccupancyByRoomType() {
  return query<{
    room_type:      string;
    total_beds:     number;
    occupied:       number;
    available:      number;
    maintenance:    number;
    occupancy_pct:  number;
  }>(
    `SELECT
       rt.name                                               AS room_type,
       COUNT(b.bed_id)                                       AS total_beds,
       SUM(b.status = 'Occupied')                            AS occupied,
       SUM(b.status = 'Available')                           AS available,
       SUM(b.status = 'Under Maintenance')                   AS maintenance,
       ROUND(SUM(b.status = 'Occupied') / COUNT(*) * 100, 1) AS occupancy_pct
     FROM beds b
     JOIN rooms      r  ON b.room_id      = r.room_id
     JOIN room_types rt ON r.room_type_id = rt.room_type_id
     GROUP BY rt.room_type_id
     ORDER BY occupancy_pct DESC`,
    [],
  );
}

// Waiting list (view) 
export async function getWaitingList() {
  return query<{
    waiting_id:        number;
    priority:          number;
    visit_type:        string;
    requested_at:      Date;
    patient_name:      string;
    patient_phone:     string;
    requesting_doctor: string;
    requested_room_type: string;
    reason:            string | null;
    notes:             string | null;
    beds_available:    number;
  }>('SELECT * FROM vw_waiting_list', []);
}

export async function addToWaitingList(data: {
  patient_id:   number;
  doctor_id:    number;
  handled_by:   number;
  room_type_id: number;
  visit_type:   'Emergency' | 'Planned' | 'Transfer';
  reason:       string | null;
}): Promise<number> {
  const priority = data.visit_type === 'Emergency' ? 1 : 5;
  const result = await query(
    `INSERT INTO admission_waiting_list
       (patient_id, doctor_id, handled_by, room_type_id, visit_type, priority, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.patient_id, data.doctor_id, data.handled_by,
      data.room_type_id, data.visit_type, priority, data.reason ?? null,
    ],
  );
  return (result as unknown as { insertId: number }).insertId;
}

//Stored procedures 
export async function admitPatient(data: {
  patient_id:    number;
  bed_id:        number | null;
  doctor_id:     number;
  staff_id:      number;
  reason:        string | null;
  visit_type:    'Emergency' | 'Planned' | 'Transfer';
  exp_discharge: string | null;
}): Promise<SpAdmitPatientResult> {
  return callProc<SpAdmitPatientResult>(
    'CALL sp_admit_patient(?, ?, ?, ?, ?, ?, ?, @adm_id, @msg)',
    [
      data.patient_id,
      data.bed_id ?? null,
      data.doctor_id,
      data.staff_id,
      data.reason ?? null,
      data.visit_type,
      data.exp_discharge ?? null,
    ],
    'SELECT @adm_id AS admission_id, @msg AS message',
  );
}

export async function transferPatient(data: {
  admission_id: number;
  new_bed_id:   number;
  staff_id:     number;
  reason:       string | null;
}): Promise<{ message: string }> {
  return callProc<{ message: string }>(
    'CALL sp_transfer_patient(?, ?, ?, ?, @msg)',
    [data.admission_id, data.new_bed_id, data.staff_id, data.reason ?? null],
    'SELECT @msg AS message',
  );
}

export async function dischargeAndBill(data: {
  admission_id:  number;
  staff_id:      number;
  summary:       string | null;
  discount_pct:  number;
}): Promise<SpDischargeAndBillResult> {
  return callProc<SpDischargeAndBillResult>(
    'CALL sp_discharge_and_bill(?, ?, ?, ?, @bill_id, @total, @msg)',
    [
      data.admission_id,
      data.staff_id,
      data.summary ?? null,
      data.discount_pct,
    ],
    'SELECT @bill_id AS bill_id, @total AS total, @msg AS message',
  );
}

// ── Overdue discharge ─────────────────────────────────────────

export async function getOverdueAdmissions() {
  return query<{
    admission_id:     number;
    patient_name:     string;
    phone:            string;
    expected_discharge: Date;
    days_overdue:     number;
    room_type:        string;
    room_number:      string;
    bed_number:       string;
    doctor:           string;
  }>(
    `SELECT
       adm.admission_id,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       p.phone,
       adm.expected_discharge,
       DATEDIFF(CURDATE(), adm.expected_discharge) AS days_overdue,
       rt.name                                     AS room_type,
       r.room_number,
       b.bed_number,
       CONCAT(d.first_name, ' ', d.last_name)      AS doctor
     FROM admissions adm
     JOIN patients   p  ON adm.patient_id          = p.patient_id
     JOIN beds       b  ON adm.bed_id              = b.bed_id
     JOIN rooms      r  ON b.room_id               = r.room_id
     JOIN room_types rt ON r.room_type_id          = rt.room_type_id
     JOIN doctors    d  ON adm.admitting_doctor_id = d.doctor_id
     WHERE adm.status = 'Active'
       AND adm.expected_discharge < CURDATE()
     ORDER BY days_overdue DESC`,
    [],
  );
}