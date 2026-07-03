import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { checkDatabaseHealth } from '../services/health.service';

export const checkHealth = catchAsync(async (req: Request, res: Response) => {
  const dbStatus = await checkDatabaseHealth();
  
  // Specific response format as requested
  const responseData = {
    status: dbStatus ? 'healthy' : 'unhealthy',
    database: dbStatus ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  };

  const statusCode = dbStatus ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE;

  res.status(statusCode).json(responseData);
});
