import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import {
  generateBillSchema, recordPaymentSchema,
  billIdSchema, revenueQuerySchema, paginationSchema,
} from './billing.schema';
import {
  getBills, countBills, getBillById, getBillItems,
  getBillPayments, getOutstandingBills,
  generateBill, recordPayment,
  getDoctorRevenue, getMonthlyRevenue, getRevenueByMethod,
} from '../../db/queries/billing.queries';

// ── GET /api/billing/bills ─────────────────────────────────────
export async function listBills(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const safePage = Math.max(1, page), safeLimit = Math.min(100, Math.max(1, limit));
    const [bills, total] = await Promise.all([
      getBills(safeLimit, (safePage - 1) * safeLimit),
      countBills(),
    ]);
    res.json({ success: true, data: bills,
      meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } });
  } catch (err) { next(err); }
}

// ── GET /api/billing/bills/:id ─────────────────────────────────
export async function getBill(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = billIdSchema.parse(req.params);
    const bill = await getBillById(id);
    if (!bill) throw new AppError('Bill not found', 404);
    const [items, payments] = await Promise.all([
      getBillItems(id), getBillPayments(id),
    ]);
    res.json({ success: true, data: { ...bill, items, payments } });
  } catch (err) { next(err); }
}

// ── POST /api/billing/bills ────────────────────────────────────
export async function createBill(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const body   = generateBillSchema.parse(req.body);
    const result = await generateBill(body);
    const bill   = await getBillById(result.bill_id);
    const items  = await getBillItems(result.bill_id);
    res.status(201).json({ success: true, message: 'Bill generated.',
      data: { ...bill, items, total_amount: result.total } });
  } catch (err) { next(err); }
}

// ── POST /api/billing/bills/:id/payment ───────────────────────
export async function makePayment(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = billIdSchema.parse(req.params);
    const body   = recordPaymentSchema.parse(req.body);

    const bill = await getBillById(id);
    if (!bill)                         throw new AppError('Bill not found', 404);
    if (bill.status === 'Paid')        throw new AppError('Bill is already fully paid', 400);
    if (bill.status === 'Cancelled')   throw new AppError('Bill is cancelled', 400);

    const result = await recordPayment({
      bill_id:      id,
      amount:       body.amount,
      method:       body.method,
      reference_no: body.reference_no,
      staff_id:     req.user!.user_id,
    });

    res.json({ success: true,
      message: `Payment recorded. Bill status: ${result.status}`,
      data:    { bill_status: result.status, balance_due: result.balance } });
  } catch (err) { next(err); }
}

// ── GET /api/billing/outstanding ──────────────────────────────
export async function outstandingBills(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getOutstandingBills();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/billing/revenue/doctor ───────────────────────────
export async function doctorRevenue(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getDoctorRevenue();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/billing/revenue/monthly?year=&month= ─────────────
export async function monthlyRevenue(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { year, month } = revenueQuerySchema.parse(req.query);
    const [monthly, byMethod] = await Promise.all([
      getMonthlyRevenue(year, month),
      getRevenueByMethod(),
    ]);
    res.json({ success: true, data: { summary: monthly, by_payment_method: byMethod } });
  } catch (err) { next(err); }
}
