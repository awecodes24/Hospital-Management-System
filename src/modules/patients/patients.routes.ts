import { Router } from 'express';
import { authenticate }  from '../../middleware/authenticate';
import { authorize }     from '../../middleware/authorize';
import {
  listPatients,
  getPatient,
  registerPatient,
  editPatient,
  patientSummary,
  patientAppointments,
  patientAdmissions,
} from './patients.controller';

export const patientsRouter = Router();

// All patient routes require login
patientsRouter.use(authenticate);

// GET  /api/patients
patientsRouter.get(  '/',                 authorize('records.view'),      listPatients);
// GET  /api/patients/:id
patientsRouter.get(  '/:id',              authorize('records.view'),      getPatient);
// POST /api/patients
patientsRouter.post( '/',                 authorize('admissions.manage'), registerPatient);
// PATCH /api/patients/:id
patientsRouter.patch('/:id',              authorize('records.edit'),      editPatient);
// GET  /api/patients/:id/summary
patientsRouter.get(  '/:id/summary',      authorize('records.view'),      patientSummary);
// GET  /api/patients/:id/appointments
patientsRouter.get(  '/:id/appointments', authorize('records.view'),      patientAppointments);
// GET  /api/patients/:id/admissions
patientsRouter.get(  '/:id/admissions',   authorize('records.view'),      patientAdmissions);

