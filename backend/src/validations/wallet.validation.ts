// backend/src/validations/wallet.validation.ts
// ----------------------------------------------------------------------------
// Zod schemas for the /users/me/wallet endpoints.
// ----------------------------------------------------------------------------

import { z } from 'zod';

// EIP-55 checksumming is the wallet's job. We accept any 0x + 40 hex chars.
const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address');

const chainSchema = z
  .string()
  .min(1, 'Chain is required')
  .max(64, 'Chain must be at most 64 characters');

const connectorSchema = z
  .string()
  .min(1, 'Connector must not be empty')
  .max(64, 'Connector must be at most 64 characters')
  .optional();

const connectedAtSchema = z
  .string()
  .datetime({ message: 'connectedAt must be an ISO 8601 datetime' })
  .optional();

export const linkWalletSchema = z.object({
  body: z.object({
    address: addressSchema,
    chain: chainSchema,
    connector: connectorSchema,
    connectedAt: connectedAtSchema,
  }),
});

export const unlinkWalletSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid wallet id'),
  }),
});
