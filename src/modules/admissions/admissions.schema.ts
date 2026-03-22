import { z } from 'zod';

export const admitPatientSchema = z.object({
  patient_id:    z.number().int().positive(),
  bed_id:        z.number().int().positive().optional(),
  doctor_id:     z.number().int().positive(),
  reason:        z.string().max(1000).optional(),
  visit_type:    z.enum(['Emergency', 'Planned', 'Transfer']),
  exp_discharge: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const dischargeSchema = z.object({
  summary:      z.string().max(2000).optional(),
  discount_pct: z.number().min(0).max(100).default(0),
});

export const transferSchema = z.object({
  new_bed_id: z.number().int().positive(),
  reason:     z.string().max(255).optional(),
});

export const waitingListSchema = z.object({
  patient_id:   z.number().int().positive(),
  doctor_id:    z.number().int().positive(),
  room_type_id: z.number().int().positive(),
  visit_type:   z.enum(['Emergency', 'Planned', 'Transfer']),
  reason:       z.string().max(1000).optional(),
});

export const admissionIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const paginationSchema = z.object({
  page:  z.string().optional().default('1').transform(Number),
  limit: z.string().optional().default('20').transform(Number),
});
