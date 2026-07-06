// frontend/components/wallet/wallet-sync.tsx
// ----------------------------------------------------------------------------
// Side-effect-only component: watches the wagmi account and, whenever a
// user authenticates with the app and connects a wallet, persists the
// (address, chain, connector, connectedAt) tuple to the backend so the
// wallet shows up under the user's profile.
//
// Renders nothing. Mounted once near the root inside <AuthProvider> so the
// effect has access to both `useAccount()` and `useAuth()`.
//
// Idempotency: a ref tracks the last address we successfully synced; we
// re-fire only when the address changes (or a previous attempt failed).
// Disconnects are intentionally NOT synced — the backend row stays so a
// reconnect from the same wallet re-links to the same id.
// ----------------------------------------------------------------------------

'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { walletService } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';

export function WalletSync() {
  const { address, isConnected, connector, chainId } = useAccount();
  const { isAuthenticated } = useAuth();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !isConnected || !address) return;
    if (lastSyncedRef.current === address) return; // already synced this address
    lastSyncedRef.current = address;

    walletService
      .linkWallet({
        address,
        chain: chainId ? `eip155:${chainId}` : 'eip155:5042002',
        connector: connector?.id,
        connectedAt: new Date().toISOString(),
      })
      .catch(() => {
        // Best-effort: if the backend call fails, allow a retry on the
        // next render by clearing the ref. We do not surface this error
        // — the next mount of the page will re-attempt.
        lastSyncedRef.current = null;
      });
  }, [isAuthenticated, isConnected, address, connector?.id, chainId]);

  return null;
}
