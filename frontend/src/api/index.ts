import api from "@/lib/axios";
import type {
  LoginResponse,
  AuthUser,
  Patient,
  CreatePatientInput,
  PatientSummary,
  Doctor,
  Department,
  Appointment,
  TodaysAppointment,
  DoctorSlots,
  BookAppointmentInput,
  Admission,
  BedOccupancy,
  OccupancySummary,
  WaitingListEntry,
  AdmitPatientInput,
  MedicalRecord,
  Prescription,
  LabResult,
  LabTest,
  Bill,
  OutstandingBill,
  DoctorRevenue,
  MonthlyRevenue,
  Medicine,
  StockReport,
  ApiResponse,
  PaginatedResponse,
} from "@/types";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<LoginResponse>>("/auth/login", { email, password }),
  me: () => api.get<ApiResponse<AuthUser>>("/auth/me"),
  changePassword: (current_password: string, new_password: string) =>
    api.patch<ApiResponse>("/auth/change-password", {
      current_password,
      new_password,
    }),
};

// ─── Patients ─────────────────────────────────────────────────────────────────
export const patientsApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get<PaginatedResponse<Patient>>("/patients", { params }),
  get: (id: number) => api.get<ApiResponse<Patient>>(`/patients/${id}`),
  create: (data: CreatePatientInput) =>
    api.post<ApiResponse<Patient>>("/patients", data),
  update: (id: number, data: Partial<CreatePatientInput>) =>
    api.patch<ApiResponse<Patient>>(`/patients/${id}`, data),
  summary: (id: number) =>
    api.get<ApiResponse<PatientSummary>>(`/patients/${id}/summary`),
  appointments: (id: number) =>
    api.get<ApiResponse<Appointment[]>>(`/patients/${id}/appointments`),
  admissions: (id: number) =>
    api.get<ApiResponse<Admission[]>>(`/patients/${id}/admissions`),
};

// ─── Doctors ──────────────────────────────────────────────────────────────────
export const doctorsApi = {
  list: () => api.get<ApiResponse<Doctor[]>>("/doctors"),
  get: (id: number) => api.get<ApiResponse<Doctor>>(`/doctors/${id}`),
  schedule: (id: number) =>
    api.get<ApiResponse<{ doctor: Doctor; schedule: Appointment[] }>>(
      `/doctors/${id}/schedule`,
    ),
};

// ─── Departments ──────────────────────────────────────────────────────────────
export const departmentsApi = {
  list: () => api.get<ApiResponse<Department[]>>("/departments"),
  get: (id: number) => api.get<ApiResponse<Department>>(`/departments/${id}`),
};

// ─── Appointments ─────────────────────────────────────────────────────────────
export const appointmentsApi = {
  today: () => api.get<ApiResponse<TodaysAppointment[]>>("/appointments/today"),
  upcoming: (days = 7) =>
    api.get<ApiResponse<Appointment[]>>("/appointments/upcoming", {
      params: { days },
    }),
  byDate: (date: string) =>
    api.get<ApiResponse<Appointment[]>>("/appointments/by-date", {
      params: { date },
    }),
  slots: (doctor_id: number, date: string) =>
    api.get<ApiResponse<DoctorSlots>>("/appointments/slots", {
      params: { doctor_id, date },
    }),
  get: (id: number) => api.get<ApiResponse<Appointment>>(`/appointments/${id}`),
  book: (data: BookAppointmentInput) =>
    api.post<ApiResponse<Appointment>>("/appointments", data),
  updateStatus: (id: number, status: string, notes?: string) =>
    api.patch<ApiResponse<Appointment>>(`/appointments/${id}/status`, {
      status,
      notes,
    }),
};

// ─── Admissions ───────────────────────────────────────────────────────────────
export const admissionsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Admission>>("/admissions", { params }),
  active: () => api.get<ApiResponse<Admission[]>>("/admissions/active"),
  bedOccupancy: () =>
    api.get<ApiResponse<{ beds: BedOccupancy[]; summary: OccupancySummary[] }>>(
      "/admissions/bed-occupancy",
    ),
  availableBeds: () =>
    api.get<ApiResponse<BedOccupancy[]>>("/admissions/available-beds"),
  waitingList: () =>
    api.get<ApiResponse<WaitingListEntry[]>>("/admissions/waiting-list"),
  overdue: () => api.get<ApiResponse<Admission[]>>("/admissions/overdue"),
  get: (id: number) => api.get<ApiResponse<Admission>>(`/admissions/${id}`),
  admit: (data: AdmitPatientInput) =>
    api.post<ApiResponse<Admission>>("/admissions", data),
  addWaiting: (data: {
    patient_id: number;
    doctor_id: number;
    room_type_id: number;
    visit_type: string;
    reason?: string;
  }) => api.post<ApiResponse>("/admissions/waiting-list", data),
  transfer: (id: number, new_bed_id: number, reason?: string) =>
    api.post<ApiResponse>(`/admissions/${id}/transfer`, { new_bed_id, reason }),
  discharge: (id: number, summary?: string, discount_pct?: number) =>
    api.post<ApiResponse>(`/admissions/${id}/discharge`, {
      summary,
      discount_pct: discount_pct ?? 0,
    }),
};

// ─── Clinical ─────────────────────────────────────────────────────────────────
export const clinicalApi = {
  records: (patient_id: number) =>
    api.get<ApiResponse<MedicalRecord[]>>("/clinical/records", {
      params: { patient_id },
    }),
  record: (id: number) =>
    api.get<ApiResponse<MedicalRecord>>(`/clinical/records/${id}`),
  createRecord: (data: Partial<MedicalRecord>) =>
    api.post<ApiResponse<MedicalRecord>>("/clinical/records", data),
  prescriptions: (patient_id: number) =>
    api.get<ApiResponse<Prescription[]>>("/clinical/prescriptions", {
      params: { patient_id },
    }),
  prescription: (id: number) =>
    api.get<ApiResponse<Prescription>>(`/clinical/prescriptions/${id}`),
  createPrescription: (data: unknown) =>
    api.post<ApiResponse<Prescription>>("/clinical/prescriptions", data),
  labTests: () => api.get<ApiResponse<LabTest[]>>("/clinical/lab-tests"),
  labResults: (patient_id: number) =>
    api.get<ApiResponse<LabResult[]>>("/clinical/lab-results", {
      params: { patient_id },
    }),
  pendingLab: () =>
    api.get<ApiResponse<LabResult[]>>("/clinical/lab-results/pending"),
  orderLab: (data: {
    patient_id: number;
    record_id?: number;
    test_id: number;
    ordered_date: string;
  }) => api.post<ApiResponse<LabResult>>("/clinical/lab-results", data),
  updateLab: (
    id: number,
    data: {
      result_value?: string;
      result_date?: string;
      status: string;
      remarks?: string;
    },
  ) => api.patch<ApiResponse<LabResult>>(`/clinical/lab-results/${id}`, data),
};

// ─── Billing ──────────────────────────────────────────────────────────────────
export const billingApi = {
  bills: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Bill>>("/billing/bills", { params }),
  bill: (id: number) => api.get<ApiResponse<Bill>>(`/billing/bills/${id}`),
  create: (data: {
    patient_id: number;
    appointment_id?: number;
    admission_id?: number;
    discount_pct?: number;
  }) => api.post<ApiResponse<Bill>>("/billing/bills", { discount_pct: 0, ...data }),
  payment: (
    id: number,
    data: { amount: number; method: string; reference_no?: string },
  ) => api.post<ApiResponse>(`/billing/bills/${id}/payment`, data),
  outstanding: () => api.get<ApiResponse<OutstandingBill[]>>("/billing/outstanding"),
  doctorRevenue: (year?: number, month?: number) =>
    api.get<ApiResponse<DoctorRevenue[]>>("/billing/revenue/doctor", {
      params: { year, month },
    }),
  monthlyRevenue: (year?: number) =>
    api.get<ApiResponse<MonthlyRevenue[]>>("/billing/revenue/monthly", {
      params: { year },
    }),
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryApi = {
  medicines: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Medicine>>("/inventory/medicines", { params }),
  medicine: (id: number) =>
    api.get<ApiResponse<Medicine>>(`/inventory/medicines/${id}`),
  lowStock: () => api.get<ApiResponse<Medicine[]>>("/inventory/stock/low"),
  stockReport: () => api.get<ApiResponse<StockReport[]>>("/inventory/stock"),
  updateStock: (id: number, quantity: number, expiry_date?: string) =>
    api.patch<ApiResponse>(`/inventory/stock/${id}`, { quantity, expiry_date }),
};
