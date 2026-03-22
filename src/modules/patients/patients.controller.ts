import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import {
  createPatientSchema,
  updatePatientSchema,
  patientIdSchema,
  paginationSchema,
} from './patients.schema';
import {
  getAllPatients,
  countPatients,
  searchPatients,
  countSearchPatients,
  getPatientById,
  getPatientByPhone,
  getPatientByEmail,
  createPatient,
  updatePatient,
  getPatientSummary,
  getPatientAppointments,
  getPatientAdmissions,
} from '../../db/queries/patients.queries';

// ── GET /api/patients ──────────────────────────────────────────
export async function listPatients(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search } = paginationSchema.parse(req.query);
    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset    = (safePage - 1) * safeLimit;

    let patients, total: number;

    if (search && search.trim()) {
      [patients, total] = await Promise.all([
        searchPatients(search.trim(), safeLimit, offset),
        countSearchPatients(search.trim()),
      ]);
    } else {
      [patients, total] = await Promise.all([
        getAllPatients(safeLimit, offset),
        countPatients(),
      ]);
    }

    res.json({
      success: true,
      data: patients,
      meta: {
        total,
        page:  safePage,
        limit: safeLimit,
        pages: Math.ceil(total / safeLimit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/patients/:id ──────────────────────────────────────
export async function getPatient(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = patientIdSchema.parse(req.params);
    const patient = await getPatientById(id);
    if (!patient) throw new AppError('Patient not found', 404);
    res.json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/patients ─────────────────────────────────────────
export async function registerPatient(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = createPatientSchema.parse(req.body);

    // Duplicate phone check
    const existing = await getPatientByPhone(data.phone);
    if (existing) {
      res.status(409).json({
        success: false,
        message: 'A patient with this phone number already exists.',
        data:    { patient_id: existing.patient_id },
      });
      return;
    }

    // Duplicate email check
    if (data.email) {
      const emailExists = await getPatientByEmail(data.email);
      if (emailExists) {
        throw new AppError('A patient with this email already exists.', 409);
      }
    }

    const patientId = await createPatient(data);
    const patient   = await getPatientById(patientId);

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully.',
      data:    patient,
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/patients/:id ────────────────────────────────────
export async function editPatient(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id }  = patientIdSchema.parse(req.params);
    const data    = updatePatientSchema.parse(req.body);

    const existing = await getPatientById(id);
    if (!existing) throw new AppError('Patient not found', 404);

    // Prevent stealing another patient's phone/email
    if (data.phone && data.phone !== existing.phone) {
      const taken = await getPatientByPhone(data.phone);
      if (taken) throw new AppError('Phone number already in use.', 409);
    }
    if (data.email && data.email !== existing.email) {
      const taken = await getPatientByEmail(data.email);
      if (taken) throw new AppError('Email already in use.', 409);
    }

    await updatePatient(id, data);
    const updated = await getPatientById(id);

    res.json({ success: true, message: 'Patient updated.', data: updated });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/patients/:id/summary ─────────────────────────────
export async function patientSummary(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = patientIdSchema.parse(req.params);
    const summary = await getPatientSummary(id);
    if (!summary) throw new AppError('Patient not found', 404);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/patients/:id/appointments ────────────────────────
export async function patientAppointments(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = patientIdSchema.parse(req.params);
    const existing = await getPatientById(id);
    if (!existing) throw new AppError('Patient not found', 404);

    const appointments = await getPatientAppointments(id);
    res.json({ success: true, data: appointments });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/patients/:id/admissions ──────────────────────────
export async function patientAdmissions(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = patientIdSchema.parse(req.params);
    const existing = await getPatientById(id);
    if (!existing) throw new AppError('Patient not found', 404);

    const admissions = await getPatientAdmissions(id);
    res.json({ success: true, data: admissions });
  } catch (err) {
    next(err);
  }
}
