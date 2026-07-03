import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import httpStatus from 'http-status';
import config from './config/config';
import v1Routes from './routes/v1';
import { errorConverter, errorHandler } from './middlewares/error.middleware';
import { sanitizeRequest } from './middlewares/sanitize.middleware';
import { apiLimiter } from './middlewares/rateLimiter';
import ApiError from './utils/ApiError';

const app: Application = express();

// ─────────────────────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true, // Allow cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Body Parsers
// ─────────────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));       // 10kb body limit prevents large payload attacks
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ─────────────────────────────────────────────────────────────────────────────
// Cookie Parser — REQUIRED for req.cookies to work
// ─────────────────────────────────────────────────────────────────────────────
app.use(cookieParser(config.cookie.secret));

// ─────────────────────────────────────────────────────────────────────────────
// Request Sanitization — XSS & NoSQL injection protection
// ─────────────────────────────────────────────────────────────────────────────
app.use(sanitizeRequest);

// ─────────────────────────────────────────────────────────────────────────────
// General API Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// Health Check (no rate limit)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    status: 'ok',
    message: 'LEO Backend API is running',
    version: '1.0.0',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/v1', v1Routes);

// ─────────────────────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'API endpoint not found'));
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handlers (must be last)
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorConverter);
app.use(errorHandler);

export default app;
