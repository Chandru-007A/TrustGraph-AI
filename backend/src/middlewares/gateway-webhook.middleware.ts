// src/middlewares/gateway-webhook.middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
// Captures the RAW request body for the webhook endpoint so HMAC signature
// validation can be performed verbatim.
//
// Express's `express.json()` parses the body into `req.body` but discards
// the original bytes. We attach a `verify` hook to record them on `req.rawBody`
// so the controller can hand the exact bytes to the HMAC comparator.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import express from 'express';

/**
 * Returns a middleware that:
 *   1. Parses the body as JSON (regular flow)
 *   2. Stashes the raw body string on `req.rawBody`
 *
 * Mount this *only* on the webhook route — every other route should keep
 * the default `express.json({ limit: '10kb' })` body parser.
 */
export const gatewayWebhookJsonParser = express.json({
  limit: '256kb',
  verify: (req: Request, _res: Response, buf: Buffer) => {
    (req as any).rawBody = buf.toString('utf8');
  },
});

/**
 * Fallback: if a raw body is not present on the request (e.g. someone
 * mounted a different parser), build one from the parsed JSON so HMAC
 * validation still has *something* to compare against.
 */
export const ensureRawBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (!(req as any).rawBody && req.body) {
    try {
      (req as any).rawBody = JSON.stringify(req.body);
    } catch {
      (req as any).rawBody = '';
    }
  }
  next();
};
