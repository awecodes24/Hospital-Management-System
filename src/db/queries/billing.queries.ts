import { query, queryOne, callProc, pool } from '../pool';
import { BillRow, BillItemRow, PaymentRow } from '../../types/db.types';
import { SpRecordPaymentResult } from '../../types/db.types';

// ── Bills ─────────────────────────────────────────────────────

export async function getBills(limit: number, offset: number) {
  return query<BillRow & { patient_name: string }>(
    `SELECT b.*,
            CONCAT(p.first_name, ' ', p.last_name) AS patient_name
     FROM bills b
     JOIN patients p ON b.patient_id = p.patient_id
     ORDER BY b.bill_date DESC
     LIMIT ${Math.abs(Math.trunc(limit))} OFFSET ${Math.abs(Math.trunc(offset))}`,
    [],
  );
}

export async function countBills(): Promise<number> {
  const rows = await query<{ total: number }>('SELECT COUNT(*) AS total FROM bills');
  return rows[0].total;
}

export async function getBillById(billId: number) {
  return queryOne<BillRow & { patient_name: string; patient_phone: string }>(
    `SELECT b.*,
            CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
            p.phone                                 AS patient_phone
     FROM bills b
     JOIN patients p ON b.patient_id = p.patient_id
     WHERE b.bill_id = ?`,
    [billId],
  );
}

export async function getBillItems(billId: number) {
  return query<BillItemRow>(
    'SELECT * FROM bill_items WHERE bill_id = ? ORDER BY bill_item_id',
    [billId],
  );
}

export async function getBillPayments(billId: number) {
  return query<PaymentRow & { received_by_name: string | null }>(
    `SELECT py.*,
            CONCAT(s.first_name, ' ', s.last_name) AS received_by_name
     FROM payments py
     LEFT JOIN staff s ON py.received_by = s.staff_id
     WHERE py.bill_id = ?
     ORDER BY py.payment_date`,
    [billId],
  );
}

export async function getOutstandingBills() {
  return query<{
    bill_id:      number;
    patient_name: string;
    phone:        string;
    bill_date:    Date;
    due_date:     Date | null;
    total_amount: number;
    amount_paid:  number;
    balance_due:  number;
    status:       string;
    days_overdue: number;
  }>('SELECT * FROM vw_outstanding_bills', []);
}

// ── Generate bill (stored procedure) ─────────────────────────

export async function generateBill(data: {
  patient_id:      number;
  appointment_id?: number;
  admission_id?:   number;
  discount_pct:    number;
}): Promise<{ bill_id: number; total: number }> {
  return callProc<{ bill_id: number; total: number }>(
    'CALL sp_generate_bill(?, ?, ?, ?, @bill_id, @total)',
    [
      data.patient_id,
      data.appointment_id ?? null,
      data.admission_id   ?? null,
      data.discount_pct,
    ],
    'SELECT @bill_id AS bill_id, @total AS total',
  );
}

// ── Record payment (stored procedure) ────────────────────────

export async function recordPayment(data: {
  bill_id:      number;
  amount:       number;
  method:       string;
  reference_no?: string;
  staff_id:     number;
}): Promise<SpRecordPaymentResult> {
  return callProc<SpRecordPaymentResult>(
    'CALL sp_record_payment(?, ?, ?, ?, ?, @status, @balance)',
    [
      data.bill_id, data.amount, data.method,
      data.reference_no ?? null, data.staff_id,
    ],
    'SELECT @status AS status, @balance AS balance',
  );
}

// ── Revenue reports ───────────────────────────────────────────

export async function getDoctorRevenue() {
  return query<{
    doctor_id:               number;
    doctor_name:             string;
    specialization:          string | null;
    department:              string | null;
    completed_appointments:  number;
    total_revenue:           number;
  }>('SELECT * FROM vw_doctor_revenue', []);
}

export async function getMonthlyRevenue(year: number, month: number): Promise<{
  month:                string;
  total_bills:          number;
  gross_revenue:        number;
  collected:            number;
  outstanding:          number;
  consultation_revenue: number;
  lab_revenue:          number;
  pharmacy_revenue:     number;
} | undefined> {
  // sp_monthly_revenue returns a result set (not OUT params)
  const conn = await pool.getConnection();
  try {
    const [results] = await conn.execute('CALL sp_monthly_revenue(?, ?)', [year, month]);
    // mysql2 wraps CALL result sets as an array of arrays
    const rows = (results as unknown[][])[0] as {
      month:                string;
      total_bills:          number;
      gross_revenue:        number;
      collected:            number;
      outstanding:          number;
      consultation_revenue: number;
      lab_revenue:          number;
      pharmacy_revenue:     number;
    }[];
    return rows[0];
  } finally {
    conn.release();
  }
}

export async function getRevenueByMethod() {
  return query<{
    method:            string;
    transactions:      number;
    total_collected:   number;
    avg_payment:       number;
  }>(
    `SELECT
       method,
       COUNT(*)            AS transactions,
       SUM(amount)         AS total_collected,
       ROUND(AVG(amount),2) AS avg_payment
     FROM payments
     GROUP BY method
     ORDER BY total_collected DESC`,
    [],
  );
}