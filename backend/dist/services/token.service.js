"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRefreshTokensForUser = exports.generateResetPasswordToken = exports.generateAuthTokens = exports.verifyDbToken = exports.saveToken = void 0;
const client_1 = require("@prisma/client");
const config_1 = __importDefault(require("../config/config"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const tokens_1 = require("../utils/tokens");
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const http_status_1 = __importDefault(require("http-status"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Persist a token record in the database.
 * Only REFRESH and RESET_PASSWORD tokens are stored.
 * ACCESS tokens are stateless and never stored.
 */
const saveToken = async (token, userId, expires, type, blacklisted = false) => {
    return prisma_1.default.token.create({
        data: { token, userId, expires, type, blacklisted },
    });
};
exports.saveToken = saveToken;
/**
 * Verify a stored token (REFRESH or RESET_PASSWORD).
 * Confirms:
 *   1. JWT signature and expiry are valid
 *   2. Token exists in the database and is not blacklisted
 *   3. Token has not expired (extra DB-level check)
 */
const verifyDbToken = async (token, type) => {
    let payload;
    try {
        payload = (0, tokens_1.verifyToken)(token);
    }
    catch (err) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, err.message || 'Invalid token');
    }
    const tokenDoc = await prisma_1.default.token.findFirst({
        where: {
            token,
            type,
            userId: payload.sub,
            blacklisted: false,
            expires: { gte: new Date() }, // DB-level expiry check as second layer
        },
    });
    if (!tokenDoc) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'Token is invalid or has expired');
    }
    return tokenDoc;
};
exports.verifyDbToken = verifyDbToken;
/**
 * Generate a paired access + refresh token set.
 * The refresh token is saved to the database.
 * The access token is stateless (not stored).
 */
const generateAuthTokens = async (userId, role) => {
    const accessTokenExpires = new Date(Date.now() + config_1.default.jwt.accessExpirationMinutes * 60 * 1000);
    const accessToken = (0, tokens_1.generateToken)(userId, role, accessTokenExpires, 'ACCESS');
    const refreshTokenExpires = new Date(Date.now() + config_1.default.jwt.refreshExpirationDays * 24 * 60 * 60 * 1000);
    const refreshToken = (0, tokens_1.generateToken)(userId, role, refreshTokenExpires, 'REFRESH');
    await (0, exports.saveToken)(refreshToken, userId, refreshTokenExpires, client_1.TokenType.REFRESH);
    return {
        access: { token: accessToken, expires: accessTokenExpires },
        refresh: { token: refreshToken, expires: refreshTokenExpires },
    };
};
exports.generateAuthTokens = generateAuthTokens;
/**
 * Generate a password reset token.
 * Deletes any existing reset tokens for the user before creating a new one.
 * Returns the raw token string (caller is responsible for emailing it).
 */
const generateResetPasswordToken = async (email) => {
    const user = await prisma_1.default.user.findUnique({ where: { email } });
    // Security: Do NOT reveal whether the email exists or not.
    // Return a success-like response regardless. Caller handles the messaging.
    if (!user) {
        logger_1.default.warn(`Reset password requested for non-existent email: ${email}`);
        return ''; // Caller should treat empty string as "no action needed"
    }
    // Clean up any existing reset tokens to prevent accumulation
    await prisma_1.default.token.deleteMany({
        where: { userId: user.id, type: client_1.TokenType.RESET_PASSWORD },
    });
    const expires = new Date(Date.now() + config_1.default.jwt.resetPasswordExpirationMinutes * 60 * 1000);
    const resetToken = (0, tokens_1.generateToken)(user.id, user.role, expires, 'RESET_PASSWORD');
    await (0, exports.saveToken)(resetToken, user.id, expires, client_1.TokenType.RESET_PASSWORD);
    return resetToken;
};
exports.generateResetPasswordToken = generateResetPasswordToken;
/**
 * Delete all refresh tokens for a user — used during logout.
 */
const deleteRefreshTokensForUser = async (userId) => {
    await prisma_1.default.token.deleteMany({
        where: { userId, type: client_1.TokenType.REFRESH },
    });
};
exports.deleteRefreshTokensForUser = deleteRefreshTokensForUser;
