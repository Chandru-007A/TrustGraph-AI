// src/validations/blockchain.validation.ts

import { z } from 'zod';

const uuidParam = z.string().uuid('Must be a valid UUID');
const txHashParam = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a valid 32-byte hex string with 0x prefix').or(uuidParam);

export const commitSchema = z.object({
  body: z.object({
    sessionId: uuidParam,
  }),
});

export const getReceiptSchema = z.object({
  params: z.object({
    workflowId: uuidParam,
  }),
});

export const getStatusSchema = z.object({
  params: z.object({
    transactionHash: txHashParam,
  }),
});

export const retrySchema = z.object({
  body: z.object({
    transactionHash: txHashParam,
  }),
});
