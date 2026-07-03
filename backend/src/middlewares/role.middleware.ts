import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';
import { Role } from '@prisma/client';

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
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          httpStatus.FORBIDDEN,
          `Access denied. Required role(s): ${roles.join(', ')}. Your role: ${req.user.role}`,
        ),
      );
    }

    next();
  };

/**
 * Shorthand role guards for common patterns.
 * Usage: router.get('/path', auth, isAdmin, handler)
 */
export const isAdmin = requireRole(Role.ADMIN);
export const isResearcher = requireRole(Role.ADMIN, Role.RESEARCHER);
export const isDeveloper = requireRole(Role.ADMIN, Role.DEVELOPER);
export const isResearcherOrDeveloper = requireRole(Role.ADMIN, Role.RESEARCHER, Role.DEVELOPER);
