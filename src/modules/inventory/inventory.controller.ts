import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../middleware/errorHandler';
import {
  getMedicines, countMedicines, getMedicineById,
  getLowStock, updateStock, getStockReport,
} from '../../db/queries/inventory.queries';

const pageSchema = z.object({
  page:  z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
});
const idSchema     = z.object({ id: z.string().regex(/^\d+$/).transform(Number) });
const stockSchema  = z.object({
  quantity:    z.number().int().min(0),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function listMedicines(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit } = pageSchema.parse(req.query);
    const safePage = Math.max(1, page), safeLimit = Math.min(100, Math.max(1, limit));
    const [medicines, total] = await Promise.all([
      getMedicines(safeLimit, (safePage - 1) * safeLimit),
      countMedicines(),
    ]);
    res.json({ success: true, data: medicines,
      meta: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) } });
  } catch (err) { next(err); }
}

export async function getMedicine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idSchema.parse(req.params);
    const med = await getMedicineById(id);
    if (!med) throw new AppError('Medicine not found', 404);
    res.json({ success: true, data: med });
  } catch (err) { next(err); }
}

export async function lowStockAlert(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getLowStock();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function stockReport(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getStockReport();
    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function patchStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = idSchema.parse(req.params);
    const { quantity, expiry_date } = stockSchema.parse(req.body);
    const med = await getMedicineById(id);
    if (!med) throw new AppError('Medicine not found', 404);
    await updateStock(id, quantity, expiry_date);
    res.json({ success: true, message: 'Stock updated.' });
  } catch (err) { next(err); }
}
