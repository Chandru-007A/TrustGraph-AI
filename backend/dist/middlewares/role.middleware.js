"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isResearcherOrDeveloper = exports.isDeveloper = exports.isResearcher = exports.isAdmin = exports.requireRole = void 0;
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../utils/ApiError"));
const client_1 = require("@prisma/client");
/**
 * Authorization Middleware — `requireRole`
 *
 * Enforces Role-Based Access Control (RBAC).
 * Must be used AFTER the `auth` middleware (which populates req.user).
 *
 * Usage in routes:
 *   router.get('/admin-only', auth, requireRole(Role.ADMIN), handler)
 *   router.get('/research', auth, requireRole(Role.ADMIN, Role.RESEARCHER), handler)
 */
const requireRole = (...roles) => (req, _res, next) => {
    if (!req.user) {
        return next(new ApiError_1.default(http_status_1.default.UNAUTHORIZED, 'Please authenticate'));
    }
    if (!roles.includes(req.user.role)) {
        return next(new ApiError_1.default(http_status_1.default.FORBIDDEN, `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`));
    }
    next();
};
exports.requireRole = requireRole;
/**
 * Shorthand role guards for common patterns.
 * Usage: router.get('/path', auth, isAdmin, handler)
 */
exports.isAdmin = (0, exports.requireRole)(client_1.Role.ADMIN);
exports.isResearcher = (0, exports.requireRole)(client_1.Role.ADMIN, client_1.Role.RESEARCHER);
exports.isDeveloper = (0, exports.requireRole)(client_1.Role.ADMIN, client_1.Role.DEVELOPER);
exports.isResearcherOrDeveloper = (0, exports.requireRole)(client_1.Role.ADMIN, client_1.Role.RESEARCHER, client_1.Role.DEVELOPER);
