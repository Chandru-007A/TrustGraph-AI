import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize Middleware — `sanitizeRequest`
 *
 * Strips dangerous characters from string values in req.body, req.query, and req.params.
 * Protects against:
 *   - Basic XSS injection (script tags, event handlers)
 *   - NoSQL operator injection ($where, $gt style keys)
 *   - MongoDB-style operator keys (prefix $)
 *
 * Note: This is a lightweight sanitizer. For a full production app,
 * also add `express-mongo-sanitize` and `xss-clean` packages.
 */

/** Recursively strip dangerous patterns from a value. */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/<script\b[^>]*>(.*?)<\/script>/gi, '')   // Remove script tags
      .replace(/javascript:/gi, '')                         // Remove JS protocol
      .replace(/on\w+\s*=/gi, '')                          // Remove inline event handlers
      .trim();
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      // Strip keys that begin with $ (NoSQL injection) or contain dots (path traversal)
      if (!key.startsWith('$') && !key.includes('.')) {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }

  return value;
}

export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query) as Record<string, string>;
  }
  if (req.params) {
    req.params = sanitizeValue(req.params) as Record<string, string>;
  }
  next();
};
