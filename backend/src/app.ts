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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      // x402 protocol: the signed envelope rides on `PAYMENT-SIGNATURE`.
      // Browsers won't send it on the retry unless the preflight
      // (OPTIONS) response explicitly allows it. Without these lines
      // the retry after MetaMask signing is aborted by the browser
      // before it leaves — surfaces as "Network Error" with no
      // server-side log.
      'PAYMENT-SIGNATURE',
      'PAYMENT-REQUIRED',
      'PAYMENT-RESPONSE',
    ],
    // x402 protocol: the 402 challenge arrives on the `PAYMENT-REQUIRED`
    // response header and the settlement receipt on `PAYMENT-RESPONSE`.
    // Browsers strip non-safelisted headers from cross-origin responses
    // unless they're explicitly exposed here — without this line the
    // frontend's x402 client sees no header and surfaces
    // "Payment challenge was malformed or empty".
    exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'],
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
