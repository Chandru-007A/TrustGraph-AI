// backend/src/controllers/explain.controller.ts
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import explainService from '../services/explain.service';

/**
 * GET /api/v1/explain/:sessionId
 * Retrieves the full AI Explainability Report for a given session.
 */
export const getExplainabilityReport = catchAsync(async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(httpStatus.UNAUTHORIZED).json(new ApiResponse(httpStatus.UNAUTHORIZED, 'Authentication required', null));
  }

  const { sessionId } = req.params;
  const report = await explainService.getExplainabilityReport(sessionId);
  
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Explainability report retrieved', report));
});
