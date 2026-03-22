import { z } from 'zod';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const createPatientSchema = z.object({
  first_name:               z.string().min(1).max(60),
  last_name:                z.string().min(1).max(60),
  date_of_birth:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  gender:                   z.enum(['Male', 'Female', 'Other']),
  blood_group:              z.enum(bloodGroups).optional(),
  email:                    z.string().email().optional(),
  phone:                    z.string().min(7).max(20),
  address:                  z.string().max(500).optional(),
  emergency_contact_name:   z.string().max(120).optional(),
  emergency_contact_phone:  z.string().max(20).optional(),
  allergies:                z.string().max(500).optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const patientIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number),
});

export const paginationSchema = z.object({
  page:   z.string().optional().default('1').transform(Number),
  limit:  z.string().optional().default('20').transform(Number),
  search: z.string().optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
