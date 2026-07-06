"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = exports.authenticate = void 0;
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const tokens_1 = require("../utils/tokens");
const prisma_1 = __importDefault(require("../utils/prisma"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Authentication Middleware — `authenticate`
 *
 * Validates the Bearer token from the Authorization header.
 * On success: attaches the user (without password) to req.user.
 * On failure: forwards a 401 Unauthorized error.
 *
 * Token validation steps:
 * 1. Parse Bearer token from Authorization header
 * 2. Verify JWT signature and expiry
 * 3. Confirm token type is ACCESS (not REFRESH or RESET_PASSWORD)
 * 4. Load user from database and confirm they still exist
 * 5. Attach stripped user to req.user
 */
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'Missing or malformed Authorization header'));
        }
        const token = authHeader.split(' ')[1];
        // Verify the JWT signature and expiry
        let payload;
        try {
            payload = (0, tokens_1.verifyToken)(token);
        }
        catch (err) {
            return next(new ApiError_1.default(http_status_1.default.UNAUTHORIZED, err.message || 'Invalid token'));
        }
        // Ensure only access tokens are accepted here
        if (payload.type !== 'ACCESS') {
            return next(new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'Invalid token type — access token required'));
        }
        // Load the user from DB to confirm they still exist and aren't deleted
        const user = await prisma_1.default.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                displayName: true,
                did: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                // Eagerly load the user's wallets so /auth/me can surface the
                // primary wallet address for the dashboard. Empty array if none.
                wallets: {
                    select: {
                        id: true,
                        address: true,
                        chain: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
                // password is intentionally excluded
            },
        });
        if (!user) {
            return next(new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'User no longer exists'));
        }
        // Normalise: a user with no wallets gets `wallets: []` for a stable shape
        // that matches SafeUser in src/types/auth.types.ts. The Prisma select
        // above can return undefined if the relation was never loaded.
        const safeUser = {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            did: user.did,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            wallets: user.wallets ?? [],
        };
        req.user = safeUser;
        next();
    }
    catch (error) {
        logger_1.default.error('Unexpected error in authenticate middleware', error);
        next(new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'Authentication failed'));
    }
};
exports.authenticate = authenticate;
/** Convenience alias — use `auth` as the middleware name in routes. */
exports.auth = exports.authenticate;
