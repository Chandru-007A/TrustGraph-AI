// backend/src/routes/v1/explain.route.ts
import express from 'express';
import { getExplainabilityReport } from '../../controllers/explain.controller';
import { auth } from '../../middlewares/auth.middleware';

const router = express.Router();

router.use(auth);

router.get('/:sessionId', getExplainabilityReport);

export default router;
