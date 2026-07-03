import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

/**
 * Validation middleware factory.
 *
 * Validates req.body, req.query, and req.params against the given Zod schema.
 * The schema should be shaped as: z.object({ body: z.object({...}), query: ..., params: ... })
 *
 * On success, the validated (and coerced) values replace the raw request properties.
 * On failure, a 400 Bad Request is forwarded to the error handler with clear field-level messages.
 */
const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Replace with validated & coerced values
      req.body = parsed.body ?? req.body;
      req.query = parsed.query ?? req.query;
      req.params = parsed.params ?? req.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('; ');
        return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
      }
      next(error);
    }
  };

export default validate;
