"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.errorConverter = void 0;
const http_status_1 = __importDefault(require("http-status"));
const client_1 = require("@prisma/client");
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const ApiError_1 = __importDefault(require("../utils/ApiError"));
/**
 * Error Converter Middleware
 *
 * Normalises any non-ApiError errors into ApiError instances.
 * Handles Prisma-specific errors with appropriate HTTP codes.
 * Must be registered BEFORE errorHandler.
 */
const errorConverter = (err, _req, _res, next) => {
    let error = err;
    if (!(error instanceof ApiError_1.default)) {
        let statusCode = http_status_1.default.INTERNAL_SERVER_ERROR;
        let message = 'An unexpected error occurred';
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            // Unique constraint violation — e.g. duplicate email
            if (error.code === 'P2002') {
                statusCode = http_status_1.default.CONFLICT;
                const fields = error.meta?.target?.join(', ') ?? 'field';
                message = `A record with this ${fields} already exists`;
            }
            // Record not found — e.g. update on non-existent ID
            else if (error.code === 'P2025') {
                statusCode = http_status_1.default.NOT_FOUND;
                message = 'Record not found';
            }
            // Foreign key constraint failure
            else if (error.code === 'P2003') {
                statusCode = http_status_1.default.BAD_REQUEST;
                message = 'Related record does not exist';
            }
            else {
                statusCode = http_status_1.default.BAD_REQUEST;
                message = 'Database operation failed';
            }
        }
        else if (error instanceof client_1.Prisma.PrismaClientValidationError) {
            statusCode = http_status_1.default.BAD_REQUEST;
            message = 'Invalid data provided to the database';
        }
        else if (error.statusCode) {
            statusCode = error.statusCode;
            message = error.message;
        }
        error = new ApiError_1.default(statusCode, message, false, err.stack);
    }
    next(error);
};
exports.errorConverter = errorConverter;
/**
 * Error Handler Middleware
 *
 * Formats and returns the final error response.
 * In production, hides internal error details for non-operational errors.
 * In development, includes the full stack trace.
 */
const errorHandler = (err, _req, res, _next) => {
    let { statusCode, message } = err;
    // In production, replace internal errors with a generic message
    if (config_1.default.isProduction && !err.isOperational) {
        statusCode = http_status_1.default.INTERNAL_SERVER_ERROR;
        message = 'Internal server error';
    }
    if (config_1.default.env === 'development') {
        logger_1.default.error(err);
    }
    const response = {
        status: 'error',
        statusCode,
        message,
    };
    // Only include stack trace in development
    if (config_1.default.env === 'development') {
        response.stack = err.stack;
    }
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
