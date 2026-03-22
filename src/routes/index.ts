import { Router } from 'express';
import { authRouter }         from '../modules/auth/auth.routes';
import { patientsRouter }     from '../modules/patients/patients.routes';
import { appointmentsRouter } from '../modules/appointments/appointments.routes';
import { admissionsRouter }   from '../modules/admissions/admissions.routes';
import { clinicalRouter }     from '../modules/clinical/clinical.routes';
import { billingRouter }      from '../modules/billing/billing.routes';
import { inventoryRouter }    from '../modules/inventory/inventory.routes';
import { doctorsRouter }      from '../modules/doctors/doctors.routes';
import { departmentsRouter }  from '../modules/departments/departments.routes';

export const router = Router();

router.use('/auth',         authRouter);
router.use('/patients',     patientsRouter);
router.use('/appointments', appointmentsRouter);
router.use('/admissions',   admissionsRouter);
router.use('/clinical',     clinicalRouter);
router.use('/billing',      billingRouter);
router.use('/inventory',    inventoryRouter);
router.use('/doctors',      doctorsRouter);
router.use('/departments',  departmentsRouter);
