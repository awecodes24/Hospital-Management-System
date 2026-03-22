import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { AppError }     from '../../middleware/errorHandler';
import { getAllDepartments, getDepartmentById } from '../../db/queries/doctors.queries';

const idSchema = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });

async function listDepartments(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getAllDepartments();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

async function getDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idSchema.parse(req.params);
    const dept = await getDepartmentById(id);
    if (!dept) throw new AppError('Department not found', 404);
    res.json({ success: true, data: dept });
  } catch (err) { next(err); }
}

export const departmentsRouter = Router();
departmentsRouter.use(authenticate);
departmentsRouter.get('/',    authorize('records.view'), listDepartments);
departmentsRouter.get('/:id', authorize('records.view'), getDepartment);
