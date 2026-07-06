"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("./config/config"));
const v1_1 = __importDefault(require("./routes/v1"));
const error_middleware_1 = require("./middlewares/error.middleware");
const sanitize_middleware_1 = require("./middlewares/sanitize.middleware");
const rateLimiter_1 = require("./middlewares/rateLimiter");
const ApiError_1 = __importDefault(require("./utils/ApiError"));
const app = (0, express_1.default)();
// ─────────────────────────────────────────────────────────────────────────────
// Security Headers
// ─────────────────────────────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use(helmet_1.default.crossOriginResourcePolicy({ policy: 'cross-origin' }));
// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
app.use((0, cors_1.default)({
    origin: config_1.default.corsOrigin,
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
}));
// ─────────────────────────────────────────────────────────────────────────────
// Body Parsers
// ─────────────────────────────────────────────────────────────────────────────
app.use(express_1.default.json({ limit: '10kb' })); // 10kb body limit prevents large payload attacks
app.use(express_1.default.urlencoded({ extended: true, limit: '10kb' }));
// ─────────────────────────────────────────────────────────────────────────────
// Cookie Parser — REQUIRED for req.cookies to work
// ─────────────────────────────────────────────────────────────────────────────
app.use((0, cookie_parser_1.default)(config_1.default.cookie.secret));
// ─────────────────────────────────────────────────────────────────────────────
// Request Sanitization — XSS & NoSQL injection protection
// ─────────────────────────────────────────────────────────────────────────────
app.use(sanitize_middleware_1.sanitizeRequest);
// ─────────────────────────────────────────────────────────────────────────────
// General API Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api', rateLimiter_1.apiLimiter);
// ─────────────────────────────────────────────────────────────────────────────
// Health Check (no rate limit)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.status(http_status_1.default.OK).json({
        status: 'ok',
        message: 'LEO Backend API is running',
        version: '1.0.0',
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/v1', v1_1.default);
// ─────────────────────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((_req, _res, next) => {
    next(new ApiError_1.default(http_status_1.default.NOT_FOUND, 'API endpoint not found'));
});
// ─────────────────────────────────────────────────────────────────────────────
// Error Handlers (must be last)
// ─────────────────────────────────────────────────────────────────────────────
app.use(error_middleware_1.errorConverter);
app.use(error_middleware_1.errorHandler);
exports.default = app;
