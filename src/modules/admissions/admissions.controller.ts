import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import {
  admitPatientSchema,
  dischargeSchema,
  transferSchema,
  waitingListSchema,
  admissionIdSchema,
  paginationSchema,
} from './admissions.schema';
import {
  getActiveAdmissions,
  getAllAdmissions,
  countAdmissions,
  getAdmissionById,
  getBedOccupancy,
  getAvailableBeds,
  getOccupancyByRoomType,
  getWaitingList,
  addToWaitingList,
  admitPatient,
  transferPatient,
  dischargeAndBill,
  getOverdueAdmissions,
} from '../../db/queries/admissions.queries';

// Helper: resolve staff_id from req.user (receptionist/admin logged in)
function getStaffId(req: Request): number {
  // user_id doubles as staff identifier for JWT holders
  return req.user!.user_id;
}

// ── GET /api/admissions ────────────────────────────────────────
export async function listAdmissions(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset    = (safePage - 1) * safeLimit;

    const [admissions, total] = await Promise.all([
      getAllAdmissions(safeLimit, offset),
      countAdmissions(),
    ]);

    res.json({
      success: true,
      data: admissions,
      meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
    });
  } catch (err) { next(err); }
}

// ── GET /api/admissions/active ─────────────────────────────────
export async function listActiveAdmissions(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getActiveAdmissions();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/admissions/bed-occupancy ──────────────────────────
export async function bedOccupancy(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const [beds, summary] = await Promise.all([
      getBedOccupancy(),
      getOccupancyByRoomType(),
    ]);
    res.json({ success: true, data: { beds, summary } });
  } catch (err) { next(err); }
}

// ── GET /api/admissions/available-beds ────────────────────────
export async function availableBeds(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getAvailableBeds();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/admissions/waiting-list ──────────────────────────
export async function waitingList(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getWaitingList();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/admissions/overdue ────────────────────────────────
export async function overdueAdmissions(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getOverdueAdmissions();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/admissions/:id ────────────────────────────────────
export async function getAdmission(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = admissionIdSchema.parse(req.params);
    const admission = await getAdmissionById(id);
    if (!admission) throw new AppError('Admission not found', 404);
    res.json({ success: true, data: admission });
  } catch (err) { next(err); }
}

// ── POST /api/admissions ───────────────────────────────────────
export async function admit(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const body     = admitPatientSchema.parse(req.body);
    const staffId  = getStaffId(req);

    const result = await admitPatient({
      patient_id:    body.patient_id,
      bed_id:        body.bed_id ?? null,
      doctor_id:     body.doctor_id,
      staff_id:      staffId,
      reason:        body.reason ?? null,
      visit_type:    body.visit_type,
      exp_discharge: body.exp_discharge ?? null,
    });

    // admission_id = 0 means waitlisted, not an error
    const statusCode = result.admission_id === 0 ? 200 : 201;

    res.status(statusCode).json({
      success: true,
      message: result.message,
      data:    result.admission_id > 0
        ? await getAdmissionById(result.admission_id)
        : null,
    });
  } catch (err) { next(err); }
}

// ── POST /api/admissions/waiting-list ─────────────────────────
export async function addWaitingList(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const body    = waitingListSchema.parse(req.body);
    const staffId = getStaffId(req);

    const waitingId = await addToWaitingList({
      patient_id:   body.patient_id,
      doctor_id:    body.doctor_id,
      handled_by:   staffId,
      room_type_id: body.room_type_id,
      visit_type:   body.visit_type,
      reason:       body.reason ?? null,
    });

    res.status(201).json({
      success: true,
      message: 'Patient added to waiting list.',
      data:    { waiting_id: waitingId },
    });
  } catch (err) { next(err); }
}

// ── POST /api/admissions/:id/transfer ─────────────────────────
export async function transfer(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id }  = admissionIdSchema.parse(req.params);
    const body    = transferSchema.parse(req.body);
    const staffId = getStaffId(req);

    const existing = await getAdmissionById(id);
    if (!existing) throw new AppError('Admission not found', 404);
    if (existing.status !== 'Active') {
      throw new AppError(`Cannot transfer a ${existing.status} admission`, 400);
    }

    const result = await transferPatient({
      admission_id: id,
      new_bed_id:   body.new_bed_id,
      staff_id:     staffId,
      reason:       body.reason ?? null,
    });

    // SP returns error message prefixed with 'Error:'
    if (result.message.startsWith('Error:')) {
      throw new AppError(result.message, 400);
    }

    res.json({ success: true, message: result.message });
  } catch (err) { next(err); }
}

// ── POST /api/admissions/:id/discharge ────────────────────────
export async function discharge(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id }  = admissionIdSchema.parse(req.params);
    const body    = dischargeSchema.parse(req.body);
    const staffId = getStaffId(req);

    const existing = await getAdmissionById(id);
    if (!existing) throw new AppError('Admission not found', 404);
    if (existing.status !== 'Active') {
      throw new AppError(`Patient is already ${existing.status}`, 400);
    }

    const result = await dischargeAndBill({
      admission_id:  id,
      staff_id:      staffId,
      summary:       body.summary ?? null,
      discount_pct:  body.discount_pct,
    });

    if (result.message.startsWith('Error:')) {
      throw new AppError(result.message, 400);
    }

    res.json({
      success: true,
      message: result.message,
      data:    { bill_id: result.bill_id, total_amount: result.total },
    });
  } catch (err) { next(err); }
}
