// src/validations/payment.validation.ts

import { z } from 'zod';

const uuidParam = z.string().uuid('Must be a valid UUID');

export const createPaymentChallengeSchema = z.object({
  body: z.object({
    workflowId: uuidParam,
    nodeId: uuidParam,
  }),
});

export const verifyPaymentSignatureSchema = z.object({
  body: z.object({
    signatureHeader: z.string().min(1, 'payment-signature string is required'),
  }),
});

export const getPaymentStatusSchema = z.object({
  params: z.object({
    paymentId: uuidParam,
  }),
});
