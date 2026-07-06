// backend/src/services/wallet.service.ts
// ----------------------------------------------------------------------------
// Wallet persistence service.
//
// `linkWallet` is idempotent on (userId, address):
//   • if a row with this address already exists and belongs to this user,
//     we update `connector` + `connectedAt` in place — no duplicate row.
//   • if a row with this address already exists but belongs to a different
//     user, we throw 409 (the address is already claimed elsewhere).
//   • otherwise, we create a new row.
//
// `listWallets` returns the user's wallets, oldest first (matches the
// `wallets` ordering on auth.service.ts:loginWithEmailAndPassword).
//
// `unlinkWallet` only deletes the row if it belongs to the calling user —
// passing another user's wallet id is a 404, not a 403, so we don't leak
// the existence of foreign wallets.
// ----------------------------------------------------------------------------

import httpStatus from 'http-status';
import prisma from '../utils/prisma';
import ApiError from '../utils/ApiError';
import type { Wallet } from '@prisma/client';

export interface LinkWalletInput {
  address: string;
  chain: string;
  connector?: string;
  connectedAt?: string;
}

export const linkWallet = async (
  userId: string,
  input: LinkWalletInput,
): Promise<Wallet> => {
  const { address, chain, connector, connectedAt } = input;
  const normalizedAddress = address.toLowerCase();

  // Address is unique across the table — a single findUnique suffices
  // to detect the "exists elsewhere" case.
  const existing = await prisma.wallet.findUnique({
    where: { address: normalizedAddress },
  });

  if (existing) {
    if (existing.userId !== userId) {
      throw new ApiError(
        httpStatus.CONFLICT,
        'This wallet is already linked to another account',
      );
    }
    // Idempotent re-link — same user, refresh connector + connectedAt.
    return prisma.wallet.update({
      where: { id: existing.id },
      data: {
        chain,
        connector: connector ?? null,
        connectedAt: connectedAt ? new Date(connectedAt) : new Date(),
      },
    });
  }

  return prisma.wallet.create({
    data: {
      userId,
      address: normalizedAddress,
      chain,
      connector: connector ?? null,
      connectedAt: connectedAt ? new Date(connectedAt) : new Date(),
    },
  });
};

export const listWallets = async (userId: string): Promise<Wallet[]> => {
  return prisma.wallet.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
};

export const unlinkWallet = async (
  userId: string,
  walletId: string,
): Promise<void> => {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet || wallet.userId !== userId) {
    // 404 instead of 403 to avoid leaking the existence of foreign wallets.
    throw new ApiError(httpStatus.NOT_FOUND, 'Wallet not found');
  }
  await prisma.wallet.delete({ where: { id: walletId } });
};

export default { linkWallet, listWallets, unlinkWallet };
