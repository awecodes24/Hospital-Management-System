import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import {
  listRecords, getRecord, createRecord,
  listPrescriptions, getPrescription, createPrescriptionHandler,
  listLabTests, listLabResults, pendingLabResults, orderLab, updateLab,
} from './clinical.controller';

export const clinicalRouter = Router();
clinicalRouter.use(authenticate);

// Medical records
clinicalRouter.get( '/records',          authorize('records.view'), listRecords);
clinicalRouter.get( '/records/:id',      authorize('records.view'), getRecord);
clinicalRouter.post('/records',          authorize('records.edit'), createRecord);

// Prescriptions
clinicalRouter.get( '/prescriptions',       authorize('records.view'), listPrescriptions);
clinicalRouter.get( '/prescriptions/:id',   authorize('records.view'), getPrescription);
clinicalRouter.post('/prescriptions',       authorize('records.edit'), createPrescriptionHandler);

// Lab
clinicalRouter.get( '/lab-tests',           authorize('records.view'),  listLabTests);
clinicalRouter.get( '/lab-results/pending', authorize('lab.manage'),    pendingLabResults);
clinicalRouter.get( '/lab-results',         authorize('records.view'),  listLabResults);
clinicalRouter.post('/lab-results',         authorize('lab.manage'),    orderLab);
clinicalRouter.patch('/lab-results/:id',    authorize('lab.manage'),    updateLab);

