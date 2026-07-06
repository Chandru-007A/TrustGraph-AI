// src/validations/workflow.validation.ts
// Zod schemas for workflow API endpoints.

import { z } from 'zod';

export const startWorkflowSchema = z.object({
  body: z.object({
    query: z
      .string()
      .min(3, 'Query must be at least 3 characters')
      .max(1000, 'Query must not exceed 1000 characters')
      .trim(),
    context: z.record(z.unknown()).optional(),
  }),
});

export const getSessionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export const getSessionDetailSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID format'),
  }),
});

export const getDagSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid workflow ID format'),
  }),
});

export const getNodeDetailSchema = z.object({
  params: z.object({
    nodeId: z.string().uuid('Invalid node ID format'),
  }),
});

export const getSessionNodeDetailSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session ID format'),
    nodeId: z.string().uuid('Invalid node ID format'),
  }),
});

