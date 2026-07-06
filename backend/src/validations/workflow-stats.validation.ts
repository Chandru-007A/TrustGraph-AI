// backend/src/validations/workflow-stats.validation.ts
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/workflow/stats — no body, query, or params.
// Kept as an empty zod schema for symmetry with other routes and to give the
// validation middleware something to pass through (it short-circuits on
// empty objects).
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

export const getStatsSchema = z.object({});
