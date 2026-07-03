import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { Prisma } from '@prisma/client';
import config from '../config/config';
import logger from '../utils/logger';
import ApiError from '../utils/ApiError';

/**
 * Error Converter Middleware
 *
 * Normalises any non-ApiError errors into ApiError instances.
 * Handles Prisma-specific errors with appropriate HTTP codes.
 * Must be registered BEFORE errorHandler.
 */
export const errorConverter = (
  err: any,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  let error = err;

  if (!(error instanceof ApiError)) {
    let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'An unexpected error occurred';

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation — e.g. duplicate email
      if (error.code === 'P2002') {
        statusCode = httpStatus.CONFLICT;
        const fields = (error.meta?.target as string[])?.join(', ') ?? 'field';
        message = `A record with this ${fields} already exists`;
      }
      // Record not found — e.g. update on non-existent ID
      else if (error.code === 'P2025') {
        statusCode = httpStatus.NOT_FOUND;
        message = 'Record not found';
      }
      // Foreign key constraint failure
      else if (error.code === 'P2003') {
        statusCode = httpStatus.BAD_REQUEST;
        message = 'Related record does not exist';
      }
      else {
        statusCode = httpStatus.BAD_REQUEST;
        message = 'Database operation failed';
      }
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      statusCode = httpStatus.BAD_REQUEST;
      message = 'Invalid data provided to the database';
    } else if (error.statusCode) {
      statusCode = error.statusCode;
      message = error.message;
    }

    error = new ApiError(statusCode, message, false, err.stack);
  }

  next(error);
};

/**
 * Error Handler Middleware
 *
 * Formats and returns the final error response.
 * In production, hides internal error details for non-operational errors.
 * In development, includes the full stack trace.
 */
export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let { statusCode, message } = err;

  // In production, replace internal errors with a generic message
  if (config.isProduction && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = 'Internal server error';
  }

  if (config.env === 'development') {
    logger.error(err);
  }

  const response: Record<string, unknown> = {
    status: 'error',
    statusCode,
    message,
  };

  // Only include stack trace in development
  if (config.env === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
