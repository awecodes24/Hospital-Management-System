import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { listMedicines, getMedicine, lowStockAlert, stockReport, patchStock } from './inventory.controller';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

inventoryRouter.get( '/medicines',       authorize('records.view'),    listMedicines);
inventoryRouter.get( '/medicines/:id',   authorize('records.view'),    getMedicine);
inventoryRouter.get( '/stock/low',       authorize('pharmacy.manage'), lowStockAlert);
inventoryRouter.get( '/stock',           authorize('pharmacy.manage'), stockReport);
inventoryRouter.patch('/stock/:id',      authorize('pharmacy.manage'), patchStock);

