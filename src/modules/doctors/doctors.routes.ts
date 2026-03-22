import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { AppError }     from '../../middleware/errorHandler';
import { getAllDoctors, getDoctorById, getDoctorSchedule } from '../../db/queries/doctors.queries';

const idSchema = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });

async function listDoctors(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getAllDoctors();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getDoctor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idSchema.parse(req.params);
    const doc = await getDoctorById(id);
    if (!doc) throw new AppError('Doctor not found', 404);
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
}

async function doctorSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idSchema.parse(req.params);
    const doc = await getDoctorById(id);
    if (!doc) throw new AppError('Doctor not found', 404);
    const schedule = await getDoctorSchedule(id);
    res.json({ success: true, data: { doctor: doc, schedule } });
  } catch (err) { next(err); }
}

export const doctorsRouter = Router();
doctorsRouter.use(authenticate);
doctorsRouter.get('/',            authorize('records.view'), listDoctors);
doctorsRouter.get('/:id',         authorize('records.view'), getDoctor);
doctorsRouter.get('/:id/schedule',authorize('appointments.manage'), doctorSchedule);
