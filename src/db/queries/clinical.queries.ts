import { query, queryOne } from '../pool';
import {
  MedicalRecordRow,
  PrescriptionRow,
  PrescriptionItemRow,
  LabResultRow,
  LabTestRow,
} from '../../types/db.types';

// ── Medical Records ───────────────────────────────────────────

export async function getMedicalRecords(patientId: number) {
  return query<MedicalRecordRow & {
    doctor_name: string;
    specialization: string | null;
  }>(
    `SELECT
       mr.*,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       d.specialization
     FROM medical_records mr
     JOIN doctors d ON mr.doctor_id = d.doctor_id
     WHERE mr.patient_id = ?
     ORDER BY mr.visit_date DESC`,
    [patientId],
  );
}

export async function getMedicalRecordById(recordId: number) {
  return queryOne<MedicalRecordRow & {
    patient_name:  string;
    doctor_name:   string;
    specialization: string | null;
  }>(
    `SELECT
       mr.*,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       d.specialization
     FROM medical_records mr
     JOIN patients p ON mr.patient_id = p.patient_id
     JOIN doctors  d ON mr.doctor_id  = d.doctor_id
     WHERE mr.record_id = ?`,
    [recordId],
  );
}

export interface CreateRecordData {
  patient_id:      number;
  doctor_id:       number;
  appointment_id?: number;
  admission_id?:   number;
  visit_date:      string;
  chief_complaint?: string;
  diagnosis?:      string;
  treatment_plan?: string;
  blood_pressure?: string;
  heart_rate?:     number;
  temperature?:    number;
  weight_kg?:      number;
  height_cm?:      number;
  oxygen_sat?:     number;
  notes?:          string;
}

export async function createMedicalRecord(data: CreateRecordData): Promise<number> {
  const result = await query(
    `INSERT INTO medical_records
       (patient_id, doctor_id, appointment_id, admission_id,
        visit_date, chief_complaint, diagnosis, treatment_plan,
        blood_pressure, heart_rate, temperature,
        weight_kg, height_cm, oxygen_sat, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.patient_id, data.doctor_id,
      data.appointment_id ?? null, data.admission_id ?? null,
      data.visit_date,
      data.chief_complaint ?? null, data.diagnosis ?? null,
      data.treatment_plan ?? null, data.blood_pressure ?? null,
      data.heart_rate ?? null, data.temperature ?? null,
      data.weight_kg ?? null, data.height_cm ?? null,
      data.oxygen_sat ?? null, data.notes ?? null,
    ],
  );
  return (result as unknown as { insertId: number }).insertId;
}

// ── Prescriptions ─────────────────────────────────────────────

export async function getPrescriptionsByPatient(patientId: number) {
  return query<PrescriptionRow & {
    doctor_name: string;
    is_valid:    boolean;
  }>(
    `SELECT
       pr.*,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
       (pr.valid_till >= CURDATE())            AS is_valid
     FROM prescriptions pr
     JOIN doctors d ON pr.doctor_id = d.doctor_id
     WHERE pr.patient_id = ?
     ORDER BY pr.prescribed_date DESC`,
    [patientId],
  );
}

export async function getPrescriptionById(prescriptionId: number) {
  return queryOne<PrescriptionRow & {
    patient_name: string;
    doctor_name:  string;
  }>(
    `SELECT
       pr.*,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
     FROM prescriptions pr
     JOIN patients p ON pr.patient_id = p.patient_id
     JOIN doctors  d ON pr.doctor_id  = d.doctor_id
     WHERE pr.prescription_id = ?`,
    [prescriptionId],
  );
}

export async function getPrescriptionItems(prescriptionId: number) {
  return query<PrescriptionItemRow & {
    medicine_name: string;
    category:      string | null;
    unit_price:    number;
  }>(
    `SELECT
       pi.*,
       m.name       AS medicine_name,
       m.category,
       m.unit_price
     FROM prescription_items pi
     JOIN medicines m ON pi.medicine_id = m.medicine_id
     WHERE pi.prescription_id = ?`,
    [prescriptionId],
  );
}

export interface CreatePrescriptionData {
  record_id:      number;
  patient_id:     number;
  doctor_id:      number;
  prescribed_date: string;
  valid_till?:    string;
  notes?:         string;
  items: {
    medicine_id:    number;
    dosage?:        string;
    frequency?:     string;
    duration_days?: number;
    quantity:       number;
    instructions?:  string;
  }[];
}

export async function createPrescription(data: CreatePrescriptionData): Promise<number> {
  // Insert header
  const result = await query(
    `INSERT INTO prescriptions
       (record_id, patient_id, doctor_id, prescribed_date, valid_till, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.record_id, data.patient_id, data.doctor_id,
      data.prescribed_date, data.valid_till ?? null, data.notes ?? null,
    ],
  );
  const prescriptionId = (result as unknown as { insertId: number }).insertId;

  // Insert items (trigger trg_deduct_stock fires for each row)
  for (const item of data.items) {
    await query(
      `INSERT INTO prescription_items
         (prescription_id, medicine_id, dosage, frequency,
          duration_days, quantity, instructions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        prescriptionId, item.medicine_id,
        item.dosage ?? null, item.frequency ?? null,
        item.duration_days ?? null, item.quantity,
        item.instructions ?? null,
      ],
    );
  }

  return prescriptionId;
}

// ── Lab Results ───────────────────────────────────────────────

export async function getLabTests() {
  return query<LabTestRow>(
    'SELECT * FROM lab_tests WHERE is_active = TRUE ORDER BY category, test_name',
    [],
  );
}

export async function getLabResultsByPatient(patientId: number) {
  return query<LabResultRow & {
    test_name:    string;
    category:     string | null;
    normal_range: string | null;
    unit:         string | null;
    ordered_by_name: string;
  }>(
    `SELECT
       lr.*,
       lt.test_name,
       lt.category,
       lt.normal_range,
       lt.unit,
       CONCAT(d.first_name, ' ', d.last_name) AS ordered_by_name
     FROM lab_results lr
     JOIN lab_tests lt ON lr.test_id    = lt.test_id
     JOIN doctors   d  ON lr.ordered_by = d.doctor_id
     WHERE lr.patient_id = ?
     ORDER BY lr.ordered_date DESC`,
    [patientId],
  );
}

export async function getPendingLabResults() {
  return query<LabResultRow & {
    patient_name: string;
    test_name:    string;
    category:     string | null;
    ordered_by_name: string;
    days_pending: number;
  }>(
    `SELECT
       lr.*,
       CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
       lt.test_name,
       lt.category,
       CONCAT(d.first_name, ' ', d.last_name) AS ordered_by_name,
       DATEDIFF(CURDATE(), lr.ordered_date)    AS days_pending
     FROM lab_results lr
     JOIN patients  p  ON lr.patient_id = p.patient_id
     JOIN lab_tests lt ON lr.test_id    = lt.test_id
     JOIN doctors   d  ON lr.ordered_by = d.doctor_id
     WHERE lr.status IN ('Ordered', 'In Progress')
     ORDER BY days_pending DESC`,
    [],
  );
}

export async function orderLabTest(data: {
  patient_id:   number;
  record_id?:   number;
  test_id:      number;
  ordered_by:   number;
  ordered_date: string;
}): Promise<number> {
  const result = await query(
    `INSERT INTO lab_results
       (patient_id, record_id, test_id, ordered_by, ordered_date, status)
     VALUES (?, ?, ?, ?, ?, 'Ordered')`,
    [
      data.patient_id, data.record_id ?? null,
      data.test_id, data.ordered_by, data.ordered_date,
    ],
  );
  return (result as unknown as { insertId: number }).insertId;
}

export async function updateLabResult(
  resultId: number,
  data: {
    result_value?: string;
    result_date?:  string;
    status:        'Ordered' | 'In Progress' | 'Completed' | 'Cancelled';
    remarks?:      string;
  },
): Promise<void> {
  await query(
    `UPDATE lab_results
     SET result_value = COALESCE(?, result_value),
         result_date  = COALESCE(?, result_date),
         status       = ?,
         remarks      = COALESCE(?, remarks)
     WHERE result_id = ?`,
    [
      data.result_value ?? null,
      data.result_date ?? null,
      data.status,
      data.remarks ?? null,
      resultId,
    ],
  );
}
