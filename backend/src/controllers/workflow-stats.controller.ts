// backend/src/controllers/workflow-stats.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin controller for GET /api/v1/workflow/stats.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import { getWorkflowStats } from '../services/workflow-stats.service';

export const getStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await getWorkflowStats(req.user!.id);

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Workflow stats retrieved', stats),
  );
});
