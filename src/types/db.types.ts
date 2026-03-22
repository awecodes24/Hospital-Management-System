// ── Auth ──────────────────────────────────────────────────────

export interface RoleRow {
  role_id:     number;
  name:        string;
  description: string | null;
}

export interface PermissionRow {
  permission_id: number;
  name:          string;
  description:   string | null;
}

export interface UserRow {
  user_id:       number;
  email:         string;
  password_hash: string;
  role_id:       number;
  role_name?:    string;   // joined from roles
  is_active:     boolean;
  last_login:    Date | null;
  created_at:    Date;
}

// ── Core ──────────────────────────────────────────────────────

export interface DepartmentRow {
  department_id:  number;
  name:           string;
  description:    string | null;
  location:       string | null;
  head_doctor_id: number | null;
  created_at:     Date;
}

export interface DoctorRow {
  doctor_id:        number;
  user_id:          number;
  first_name:       string;
  last_name:        string;
  phone:            string | null;
  specialization:   string | null;
  department_id:    number | null;
  department_name?: string;    // joined from departments
  license_number:   string;
  consultation_fee: number;
  available_days:   string;
  available_from:   string;
  available_to:     string;
  is_active:        boolean;
  joined_date:      Date | null;
}

export interface PatientRow {
  patient_id:              number;
  first_name:              string;
  last_name:               string;
  date_of_birth:           Date;
  gender:                  'Male' | 'Female' | 'Other';
  blood_group:             string | null;
  email:                   string | null;
  phone:                   string;
  address:                 string | null;
  emergency_contact_name:  string | null;
  emergency_contact_phone: string | null;
  allergies:               string | null;
  created_at:              Date;
  updated_at:              Date;
}

export interface StaffRow {
  staff_id:      number;
  user_id:       number;
  first_name:    string;
  last_name:     string;
  phone:         string | null;
  job_title:     string | null;
  department_id: number | null;
  is_active:     boolean;
  joined_date:   Date | null;
}

// ── Rooms & Beds ──────────────────────────────────────────────

export interface RoomTypeRow {
  room_type_id: number;
  name:         string;
  description:  string | null;
  daily_rate:   number;
}

export interface RoomRow {
  room_id:      number;
  room_number:  string;
  room_type_id: number;
  department_id: number | null;
  floor:        number | null;
  total_beds:   number;
  is_active:    boolean;
}

export interface BedRow {
  bed_id:     number;
  room_id:    number;
  bed_number: string;
  status:     'Available' | 'Occupied' | 'Under Maintenance';
}

// ── Admissions ────────────────────────────────────────────────

export interface AdmissionRow {
  admission_id:        number;
  patient_id:          number;
  bed_id:              number;
  admitting_doctor_id: number;
  admitted_by:         number | null;
  admission_date:      Date;
  expected_discharge:  Date | null;
  actual_discharge:    Date | null;
  admission_reason:    string | null;
  visit_type:          'Emergency' | 'Planned' | 'Transfer';
  discharge_summary:   string | null;
  status:              'Active' | 'Discharged' | 'Transferred' | 'Absconded';
  created_at:          Date;
}

export interface WaitingListRow {
  waiting_id:   number;
  patient_id:   number;
  doctor_id:    number;
  handled_by:   number | null;
  room_type_id: number;
  visit_type:   'Emergency' | 'Planned' | 'Transfer';
  priority:     number;
  reason:       string | null;
  requested_at: Date;
  resolved_at:  Date | null;
  status:       'Waiting' | 'Admitted' | 'Cancelled';
  notes:        string | null;
}

// ── Clinical ──────────────────────────────────────────────────

export interface AppointmentRow {
  appointment_id:   number;
  patient_id:       number;
  doctor_id:        number;
  appointment_date: Date;
  appointment_time: string;
  reason:           string | null;
  status:           'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-Show';
  notes:            string | null;
  created_at:       Date;
}

export interface MedicalRecordRow {
  record_id:       number;
  patient_id:      number;
  doctor_id:       number;
  appointment_id:  number | null;
  admission_id:    number | null;
  visit_date:      Date;
  chief_complaint: string | null;
  diagnosis:       string | null;
  treatment_plan:  string | null;
  blood_pressure:  string | null;
  heart_rate:      number | null;
  temperature:     number | null;
  weight_kg:       number | null;
  height_cm:       number | null;
  oxygen_sat:      number | null;
  notes:           string | null;
  created_at:      Date;
}

export interface PrescriptionRow {
  prescription_id: number;
  record_id:       number;
  patient_id:      number;
  doctor_id:       number;
  prescribed_date: Date;
  valid_till:      Date | null;
  notes:           string | null;
}

export interface PrescriptionItemRow {
  item_id:         number;
  prescription_id: number;
  medicine_id:     number;
  dosage:          string | null;
  frequency:       string | null;
  duration_days:   number | null;
  quantity:        number;
  instructions:    string | null;
}

export interface LabTestRow {
  test_id:      number;
  test_name:    string;
  category:     string | null;
  normal_range: string | null;
  unit:         string | null;
  base_price:   number;
  is_active:    boolean;
}

export interface LabResultRow {
  result_id:    number;
  patient_id:   number;
  record_id:    number | null;
  test_id:      number;
  ordered_by:   number;
  ordered_date: Date;
  result_date:  Date | null;
  result_value: string | null;
  status:       'Ordered' | 'In Progress' | 'Completed' | 'Cancelled';
  remarks:      string | null;
}

// ── Inventory ─────────────────────────────────────────────────

export interface MedicineRow {
  medicine_id:           number;
  name:                  string;
  generic_name:          string | null;
  category:              string | null;
  manufacturer:          string | null;
  unit_price:            number;
  requires_prescription: boolean;
  is_active:             boolean;
}

export interface MedicineStockRow {
  stock_id:      number;
  medicine_id:   number;
  quantity:      number;
  reorder_level: number;
  expiry_date:   Date | null;
  last_updated:  Date;
}

// ── Billing ───────────────────────────────────────────────────

export interface BillRow {
  bill_id:        number;
  patient_id:     number;
  appointment_id: number | null;
  admission_id:   number | null;
  bill_date:      Date;
  due_date:       Date | null;
  subtotal:       number;
  discount_pct:   number;
  tax_pct:        number;
  total_amount:   number;
  amount_paid:    number;
  status:         'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Cancelled';
  notes:          string | null;
}

export interface BillItemRow {
  bill_item_id: number;
  bill_id:      number;
  item_type:    'Consultation' | 'Lab Test' | 'Medicine' | 'Procedure' | 'Room' | 'Other';
  description:  string;
  quantity:     number;
  unit_price:   number;
  line_total:   number;
}

export interface PaymentRow {
  payment_id:   number;
  bill_id:      number;
  payment_date: Date;
  amount:       number;
  method:       'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Payment' | 'Insurance';
  reference_no: string | null;
  received_by:  number | null;
  notes:        string | null;
}

// ── Stored procedure OUT results ──────────────────────────────

export interface SpBookAppointmentResult {
  appointment_id: number;
  message:        string;
}

export interface SpAdmitPatientResult {
  admission_id: number;
  message:      string;
}

export interface SpDischargeAndBillResult {
  bill_id:  number;
  total:    number;
  message:  string;
}

export interface SpRecordPaymentResult {
  status:  string;
  balance: number;
}

export interface SpRegisterPatientResult {
  patient_id: number;
  message:    string;
}
