import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import {
  listBills, getBill, createBill, makePayment,
  outstandingBills, doctorRevenue, monthlyRevenue,
} from './billing.controller';

export const billingRouter = Router();
billingRouter.use(authenticate);

billingRouter.get( '/bills',                authorize('billing.create'),  listBills);
billingRouter.get( '/bills/:id',            authorize('billing.create'),  getBill);
billingRouter.post('/bills',                authorize('billing.create'),  createBill);
billingRouter.post('/bills/:id/payment',    authorize('billing.payment'), makePayment);
billingRouter.get( '/outstanding',          authorize('billing.create'),  outstandingBills);
billingRouter.get( '/revenue/doctor',       authorize('reports.view'),    doctorRevenue);
billingRouter.get( '/revenue/monthly',      authorize('reports.view'),    monthlyRevenue);

