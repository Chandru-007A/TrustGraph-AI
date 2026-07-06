// backend/src/routes/v1/admin.route.ts
import express from 'express';
import { auth } from '../../middlewares/auth.middleware';
import * as adminController from '../../controllers/admin.controller';

const router = express.Router();

router.use(auth);
router.use(adminController.enforceAdmin);

router.get('/overview', adminController.getOverview);
router.get('/workflows', adminController.getWorkflows);
router.get('/health', adminController.getHealth);
router.get('/performance', adminController.getPerformance);
router.get('/failures', adminController.getFailures);
router.get('/blockchain', adminController.getBlockchain);
router.get('/payments', adminController.getPayments);
router.get('/security', adminController.getSecurity);
router.get('/activity', adminController.getActivity);

export default router;
