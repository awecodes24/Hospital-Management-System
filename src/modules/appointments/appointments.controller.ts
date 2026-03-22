import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import {
  bookAppointmentSchema,
  updateStatusSchema,
  appointmentIdSchema,
  dateQuerySchema,
  doctorSlotsSchema,
} from './appointments.schema';
import {
  getTodaysAppointments,
  getAppointmentsByDate,
  getUpcomingAppointments,
  getAppointmentById,
  getDoctorBookedSlots,
  getDoctorAvailability,
  bookAppointment,
  updateAppointmentStatus,
} from '../../db/queries/appointments.queries';

// ── GET /api/appointments/today ────────────────────────────────
export async function todaysAppointments(
  _req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const data = await getTodaysAppointments();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/appointments/upcoming?days=7 ─────────────────────
export async function upcomingAppointments(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { days } = dateQuerySchema.parse(req.query);
    const safeDays  = Math.min(30, Math.max(1, days));
    const data      = await getUpcomingAppointments(safeDays);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/appointments/by-date?date=YYYY-MM-DD ─────────────
export async function appointmentsByDate(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { date } = dateQuerySchema.parse(req.query);
    if (!date) throw new AppError('date query param is required', 400);
    const data = await getAppointmentsByDate(date);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/appointments/:id ─────────────────────────────────
export async function getAppointment(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id } = appointmentIdSchema.parse(req.params);
    const appt   = await getAppointmentById(id);
    if (!appt) throw new AppError('Appointment not found', 404);
    res.json({ success: true, data: appt });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/appointments/slots?doctor_id=&date= ──────────────
export async function doctorSlots(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { doctor_id, date } = doctorSlotsSchema.parse(req.query);

    const [availability, bookedSlots] = await Promise.all([
      getDoctorAvailability(doctor_id),
      getDoctorBookedSlots(doctor_id, date),
    ]);

    if (!availability) throw new AppError('Doctor not found', 404);
    if (!availability.is_active) throw new AppError('Doctor is not currently active', 400);

    res.json({
      success: true,
      data: {
        doctor:       availability.doctor_name,
        specialization: availability.specialization,
        available_days: availability.available_days,
        available_from: availability.available_from,
        available_to:   availability.available_to,
        date,
        booked_slots:   bookedSlots,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/appointments ────────────────────────────────────
export async function book(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { patient_id, doctor_id, date, time, reason } =
      bookAppointmentSchema.parse(req.body);

    const result = await bookAppointment(
      patient_id, doctor_id, date, time, reason ?? null,
    );

    // Stored procedure returns 0 on failure with an error message
    if (result.appointment_id === 0) {
      throw new AppError(result.message, 409);
    }

    const appt = await getAppointmentById(result.appointment_id);

    res.status(201).json({
      success: true,
      message: result.message,
      data:    appt,
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/appointments/:id/status ────────────────────────
export async function changeStatus(
  req: Request, res: Response, next: NextFunction,
): Promise<void> {
  try {
    const { id }       = appointmentIdSchema.parse(req.params);
    const { status, notes } = updateStatusSchema.parse(req.body);

    const appt = await getAppointmentById(id);
    if (!appt) throw new AppError('Appointment not found', 404);

    // Guard: cannot reopen a completed appointment
    if (appt.status === 'Completed' && status !== 'Completed') {
      throw new AppError('Cannot change status of a completed appointment', 400);
    }

    await updateAppointmentStatus(id, status, notes);

    res.json({ success: true, message: `Appointment marked as ${status}.` });
  } catch (err) {
    next(err);
  }
}
