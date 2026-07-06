"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserById = exports.resetUserPassword = exports.changeUserPassword = exports.refreshUserToken = exports.logoutUser = exports.loginWithEmailAndPassword = exports.registerUser = void 0;
const http_status_1 = __importDefault(require("http-status"));
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../utils/prisma"));
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const encryption_1 = require("../utils/encryption");
const token_service_1 = require("./token.service");
const logger_1 = __importDefault(require("../utils/logger"));
/** Strip password from user object before returning to any client. */
const toSafeUser = (user) => {
    const { password, wallets, ...safe } = user;
    return { ...safe, wallets: wallets ?? [] };
};
// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Register a new user.
 * Throws 409 if the email is already taken.
 * Returns the created user without the password field, with an empty
 * `wallets` array (new users have no wallets yet).
 */
const registerUser = async (data) => {
    const existing = await prisma_1.default.user.findUnique({ where: { email: data.email } });
    if (existing) {
        throw new ApiError_1.default(http_status_1.default.CONFLICT, 'Email address is already registered');
    }
    const hashedPassword = await (0, encryption_1.hashPassword)(data.password);
    const user = await prisma_1.default.user.create({
        data: {
            email: data.email,
            password: hashedPassword,
            displayName: data.displayName ?? null,
            role: data.role ?? client_1.Role.CONSUMER,
        },
    });
    logger_1.default.info(`New user registered: ${user.email} (role: ${user.role})`);
    return toSafeUser(user);
};
exports.registerUser = registerUser;
// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Authenticate a user with email and password.
 * Returns the full user object (including role) for token generation.
 * Eagerly loads the user's wallets so the login response shape matches
 * what /auth/me returns (no client-side flicker after login).
 * Throws 401 with a generic message — never reveals whether the email exists.
 */
const loginWithEmailAndPassword = async (email, password) => {
    const user = await prisma_1.default.user.findUnique({
        where: { email },
        include: {
            wallets: {
                select: { id: true, address: true, chain: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    // Use constant-time comparison even for missing users to prevent timing attacks
    const passwordValid = user ? await (0, encryption_1.isPasswordMatch)(password, user.password) : false;
    if (!user || !passwordValid) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'Invalid email or password');
    }
    logger_1.default.info(`User logged in: ${user.email}`);
    return toSafeUser(user);
};
exports.loginWithEmailAndPassword = loginWithEmailAndPassword;
// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Logout user by deleting their refresh token from the database.
 * If no token is found, we still return success (idempotent logout).
 */
const logoutUser = async (refreshToken) => {
    const tokenDoc = await prisma_1.default.token.findFirst({
        where: { token: refreshToken, type: client_1.TokenType.REFRESH, blacklisted: false },
    });
    if (tokenDoc) {
        await prisma_1.default.token.delete({ where: { id: tokenDoc.id } });
        logger_1.default.info(`Refresh token deleted for user: ${tokenDoc.userId}`);
    }
};
exports.logoutUser = logoutUser;
// ─────────────────────────────────────────────────────────────────────────────
// Refresh Tokens
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rotate refresh token — invalidate old one, return the user for new token generation.
 * Implements "refresh token rotation" — each refresh produces a new refresh token.
 */
const refreshUserToken = async (refreshToken) => {
    const tokenDoc = await (0, token_service_1.verifyDbToken)(refreshToken, client_1.TokenType.REFRESH);
    const user = await prisma_1.default.user.findUnique({ where: { id: tokenDoc.userId } });
    if (!user) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'User no longer exists');
    }
    // Delete the consumed refresh token (rotation)
    await prisma_1.default.token.delete({ where: { id: tokenDoc.id } });
    return user;
};
exports.refreshUserToken = refreshUserToken;
// ─────────────────────────────────────────────────────────────────────────────
// Change Password
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Change a user's password.
 * Validates old password, updates to new hash, and invalidates all refresh tokens
 * to force re-login on all devices.
 */
const changeUserPassword = async (userId, oldPassword, newPassword) => {
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const isMatch = await (0, encryption_1.isPasswordMatch)(oldPassword, user.password);
    if (!isMatch) {
        throw new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'Incorrect current password');
    }
    const hashedPassword = await (0, encryption_1.hashPassword)(newPassword);
    await prisma_1.default.user.update({ where: { id: userId }, data: { password: hashedPassword } });
    // Invalidate all active sessions by deleting all refresh tokens
    await (0, token_service_1.deleteRefreshTokensForUser)(userId);
    logger_1.default.info(`Password changed for user: ${user.email}. All sessions invalidated.`);
};
exports.changeUserPassword = changeUserPassword;
// ─────────────────────────────────────────────────────────────────────────────
// Reset Password
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Reset a user's password using a valid reset token.
 * On success: updates password, deletes all reset tokens, deletes all refresh tokens.
 */
const resetUserPassword = async (resetToken, newPassword) => {
    const tokenDoc = await (0, token_service_1.verifyDbToken)(resetToken, client_1.TokenType.RESET_PASSWORD);
    const user = await prisma_1.default.user.findUnique({ where: { id: tokenDoc.userId } });
    if (!user) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const hashedPassword = await (0, encryption_1.hashPassword)(newPassword);
    await prisma_1.default.$transaction([
        prisma_1.default.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
        prisma_1.default.token.deleteMany({ where: { userId: user.id, type: client_1.TokenType.RESET_PASSWORD } }),
        prisma_1.default.token.deleteMany({ where: { userId: user.id, type: client_1.TokenType.REFRESH } }),
    ]);
    logger_1.default.info(`Password reset for user: ${user.email}. All sessions invalidated.`);
};
exports.resetUserPassword = resetUserPassword;
// ─────────────────────────────────────────────────────────────────────────────
// Get Current User
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fetch a user's profile by ID, returning a safe user (no password).
 */
const getUserById = async (userId) => {
    const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new ApiError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    return toSafeUser(user);
};
exports.getUserById = getUserById;
