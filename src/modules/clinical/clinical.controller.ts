import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import {
  createRecordSchema,
  createPrescriptionSchema,
  orderLabTestSchema,
  updateLabResultSchema,
  idSchema,
  patientQuerySchema,
} from './clinical.schema';
import {
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  getPrescriptionsByPatient,
  getPrescriptionById,
  getPrescriptionItems,
  createPrescription,
  getLabTests,
  getLabResultsByPatient,
  getPendingLabResults,
  orderLabTest,
  updateLabResult,
} from '../../db/queries/clinical.queries';

// ── GET /api/clinical/records?patient_id= ─────────────────────
export async function listRecords(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { patient_id } = patientQuerySchema.parse(req.query);
    const data = await getMedicalRecords(patient_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/clinical/records/:id ─────────────────────────────
export async function getRecord(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = idSchema.parse(req.params);
    const record = await getMedicalRecordById(id);
    if (!record) throw new AppError('Medical record not found', 404);
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
}

// ── POST /api/clinical/records ────────────────────────────────
export async function createRecord(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const body     = createRecordSchema.parse(req.body);
    const doctorId = req.user!.user_id; // doctor creating the record

    const recordId = await createMedicalRecord({ ...body, doctor_id: doctorId });
    const record   = await getMedicalRecordById(recordId);

    res.status(201).json({
      success: true,
      message: 'Medical record created.',
      data:    record,
    });
  } catch (err) { next(err); }
}

// ── GET /api/clinical/prescriptions?patient_id= ───────────────
export async function listPrescriptions(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { patient_id } = patientQuerySchema.parse(req.query);
    const data = await getPrescriptionsByPatient(patient_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/clinical/prescriptions/:id ───────────────────────
export async function getPrescription(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = idSchema.parse(req.params);
    const prescription = await getPrescriptionById(id);
    if (!prescription) throw new AppError('Prescription not found', 404);

    const items = await getPrescriptionItems(id);
    res.json({ success: true, data: { ...prescription, items } });
  } catch (err) { next(err); }
}

// ── POST /api/clinical/prescriptions ──────────────────────────
export async function createPrescriptionHandler(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const body     = createPrescriptionSchema.parse(req.body);
    const doctorId = req.user!.user_id;

    const prescriptionId = await createPrescription({ ...body, doctor_id: doctorId });
    const prescription   = await getPrescriptionById(prescriptionId);
    const items          = await getPrescriptionItems(prescriptionId);

    res.status(201).json({
      success: true,
      message: 'Prescription created. Stock deducted automatically.',
      data:    { ...prescription, items },
    });
  } catch (err) { next(err); }
}

// ── GET /api/clinical/lab-tests ───────────────────────────────
export async function listLabTests(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getLabTests();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/clinical/lab-results?patient_id= ─────────────────
export async function listLabResults(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { patient_id } = patientQuerySchema.parse(req.query);
    const data = await getLabResultsByPatient(patient_id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── GET /api/clinical/lab-results/pending ─────────────────────
export async function pendingLabResults(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getPendingLabResults();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ── POST /api/clinical/lab-results ────────────────────────────
export async function orderLab(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const body      = orderLabTestSchema.parse(req.body);
    const doctorId  = req.user!.user_id;

    const resultId = await orderLabTest({ ...body, ordered_by: doctorId });

    res.status(201).json({
      success: true,
      message: 'Lab test ordered.',
      data:    { result_id: resultId },
    });
  } catch (err) { next(err); }
}

// ── PATCH /api/clinical/lab-results/:id ───────────────────────
export async function updateLab(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = idSchema.parse(req.params);
    const body   = updateLabResultSchema.parse(req.body);

    await updateLabResult(id, body);
    res.json({ success: true, message: 'Lab result updated.' });
  } catch (err) { next(err); }
}
