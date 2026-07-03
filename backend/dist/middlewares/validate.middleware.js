"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const http_status_1 = __importDefault(require("http-status"));
const ApiError_1 = __importDefault(require("../utils/ApiError"));
/**
 * Validation middleware factory.
 *
 * Validates req.body, req.query, and req.params against the given Zod schema.
 * The schema should be shaped as: z.object({ body: z.object({...}), query: ..., params: ... })
 *
 * On success, the validated (and coerced) values replace the raw request properties.
 * On failure, a 400 Bad Request is forwarded to the error handler with clear field-level messages.
 */
const validate = (schema) => (req, _res, next) => {
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
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            const errorMessage = error.errors
                .map((e) => `${e.path.join('.')}: ${e.message}`)
                .join('; ');
            return next(new ApiError_1.default(http_status_1.default.BAD_REQUEST, errorMessage));
        }
        next(error);
    }
};
exports.default = validate;
