import { z } from 'zod';

export const bookAppointmentSchema = z.object({
  patient_id: z.number().int().positive(),
  doctor_id:  z.number().int().positive(),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  time:       z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM'),
  reason:     z.string().max(255).optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-Show']),
  notes:  z.string().max(1000).optional(),
});

export const appointmentIdSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  days: z.string().optional().default('7').transform(Number),
});

export const doctorSlotsSchema = z.object({
  doctor_id: z.string().regex(/^\d+$/).transform(Number),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});

export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type UpdateStatusInput    = z.infer<typeof updateStatusSchema>;
