// backend/src/controllers/admin.controller.ts
import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import adminService from '../services/admin.service';
import ApiError from '../utils/ApiError';

/** Middleware to enforce ADMIN role inline in the controller or route */
export const enforceAdmin = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required'));
  }
  if (req.user.role !== 'ADMIN') {
    return next(new ApiError(httpStatus.FORBIDDEN, 'Forbidden: Admin access only'));
  }
  next();
};

export const getOverview = catchAsync(async (req: Request, res: Response) => {
  const data = await adminService.getOverview();
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Platform overview retrieved', data));
});

export const getWorkflows = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const status = req.query.status as string;

  const data = await adminService.getWorkflows(page, limit, search, status);
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Workflows retrieved', data));
});

export const getHealth = catchAsync(async (req: Request, res: Response) => {
  const data = await adminService.getHealth();
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'System health retrieved', data));
});

export const getPerformance = catchAsync(async (req: Request, res: Response) => {
  const data = await adminService.getPerformance();
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Performance analytics retrieved', data));
});

export const getFailures = catchAsync(async (req: Request, res: Response) => {
  const data = await adminService.getFailures();
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Failure monitor retrieved', data));
});

export const getBlockchain = catchAsync(async (req: Request, res: Response) => {
  const data = await adminService.getBlockchain();
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Blockchain monitor retrieved', data));
});

export const getPayments = catchAsync(async (req: Request, res: Response) => {
  const data = await adminService.getPayments();
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Payment monitor retrieved', data));
});

export const getSecurity = catchAsync(async (req: Request, res: Response) => {
  const data = await adminService.getSecurity();
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Security monitor retrieved', data));
});

export const getActivity = catchAsync(async (req: Request, res: Response) => {
  const data = await adminService.getActivity();
  res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, 'Recent activity retrieved', data));
});
