import { z } from 'zod';

export const createRecordSchema = z.object({
  patient_id:      z.number().int().positive(),
  appointment_id:  z.number().int().positive().optional(),
  admission_id:    z.number().int().positive().optional(),
  visit_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chief_complaint: z.string().max(500).optional(),
  diagnosis:       z.string().max(1000).optional(),
  treatment_plan:  z.string().max(1000).optional(),
  blood_pressure:  z.string().max(20).optional(),
  heart_rate:      z.number().int().positive().max(300).optional(),
  temperature:     z.number().min(30).max(45).optional(),
  weight_kg:       z.number().positive().max(500).optional(),
  height_cm:       z.number().positive().max(300).optional(),
  oxygen_sat:      z.number().int().min(0).max(100).optional(),
  notes:           z.string().max(2000).optional(),
});

export const prescriptionItemSchema = z.object({
  medicine_id:    z.number().int().positive(),
  dosage:         z.string().max(50).optional(),
  frequency:      z.string().max(50).optional(),
  duration_days:  z.number().int().positive().max(365).optional(),
  quantity:       z.number().int().positive(),
  instructions:   z.string().max(255).optional(),
});

export const createPrescriptionSchema = z.object({
  record_id:       z.number().int().positive(),
  patient_id:      z.number().int().positive(),
  prescribed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_till:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes:           z.string().max(500).optional(),
  items:           z.array(prescriptionItemSchema).min(1, 'At least one medicine required'),
});

export const orderLabTestSchema = z.object({
  patient_id:   z.number().int().positive(),
  record_id:    z.number().int().positive().optional(),
  test_id:      z.number().int().positive(),
  ordered_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const updateLabResultSchema = z.object({
  result_value: z.string().max(200).optional(),
  result_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status:       z.enum(['Ordered', 'In Progress', 'Completed', 'Cancelled']),
  remarks:      z.string().max(1000).optional(),
});

export const idSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export const patientQuerySchema = z.object({
  patient_id: z.string().regex(/^\d+$/).transform(Number),
});
