import { z } from 'zod';

export const generateBillSchema = z.object({
  patient_id:     z.number().int().positive(),
  appointment_id: z.number().int().positive().optional(),
  admission_id:   z.number().int().positive().optional(),
  discount_pct:   z.number().min(0).max(100).default(0),
});

export const recordPaymentSchema = z.object({
  amount:       z.number().positive(),
  method:       z.enum(['Cash', 'Card', 'Bank Transfer', 'Mobile Payment', 'Insurance']),
  reference_no: z.string().max(100).optional(),
});

export const billIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const revenueQuerySchema = z.object({
  year:  z.string().optional().transform((v) => v ? Number(v) : new Date().getFullYear()),
  month: z.string().optional().transform((v) => v ? Number(v) : new Date().getMonth() + 1),
});

export const paginationSchema = z.object({
  page:  z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
});
