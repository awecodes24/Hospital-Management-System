import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import {
  todaysAppointments,
  upcomingAppointments,
  appointmentsByDate,
  getAppointment,
  doctorSlots,
  book,
  changeStatus,
} from './appointments.controller';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);

// GET  /api/appointments/today
appointmentsRouter.get('/today',    authorize('appointments.manage'), todaysAppointments);
// GET  /api/appointments/upcoming?days=7
appointmentsRouter.get('/upcoming', authorize('appointments.manage'), upcomingAppointments);
// GET  /api/appointments/by-date?date=YYYY-MM-DD
appointmentsRouter.get('/by-date',  authorize('appointments.manage'), appointmentsByDate);
// GET  /api/appointments/slots?doctor_id=&date=
appointmentsRouter.get('/slots',    authorize('appointments.manage'), doctorSlots);

// GET  /api/appointments/:id
appointmentsRouter.get('/:id',      authorize('appointments.manage'), getAppointment);
// POST /api/appointments
appointmentsRouter.post('/',        authorize('appointments.manage'), book);
// PATCH /api/appointments/:id/status
appointmentsRouter.patch('/:id/status', authorize('appointments.manage'), changeStatus);

