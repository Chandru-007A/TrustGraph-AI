import express from 'express';
import { checkHealth } from '../../controllers/health.controller';

const router = express.Router();

router.route('/').get(checkHealth);

export default router;
