import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import {
  listAdmissions,
  listActiveAdmissions,
  bedOccupancy,
  availableBeds,
  waitingList,
  overdueAdmissions,
  getAdmission,
  admit,
  addWaitingList,
  transfer,
  discharge,
} from './admissions.controller';

export const admissionsRouter = Router();
admissionsRouter.use(authenticate);

// Reference / read
admissionsRouter.get('/',                authorize('admissions.manage'), listAdmissions);
admissionsRouter.get('/active',          authorize('admissions.manage'), listActiveAdmissions);
admissionsRouter.get('/bed-occupancy',   authorize('admissions.manage'), bedOccupancy);
admissionsRouter.get('/available-beds',  authorize('admissions.manage'), availableBeds);
admissionsRouter.get('/waiting-list',    authorize('admissions.manage'), waitingList);
admissionsRouter.get('/overdue',         authorize('admissions.manage'), overdueAdmissions);
admissionsRouter.get('/:id',             authorize('admissions.manage'), getAdmission);

// Actions
admissionsRouter.post('/',               authorize('admissions.manage'), admit);
admissionsRouter.post('/waiting-list',   authorize('admissions.manage'), addWaitingList);
admissionsRouter.post('/:id/transfer',   authorize('admissions.manage'), transfer);
admissionsRouter.post('/:id/discharge',  authorize('admissions.manage'), discharge);

