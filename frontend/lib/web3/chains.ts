// frontend/lib/web3/chains.ts
// ----------------------------------------------------------------------------
// EVM chain definitions for the TrustGraph wallet integration.
//
// The primary chain is Arc Testnet (chain id 5042002), matching the
// `eip155:5042002` network string the backend emits in its x402 challenge.
// The chain id is the only value that matters for the Phase 21 wallet
// flow — the RPC URL and block explorer are placeholders that should be
// overridden via env vars when the real Arc L1 / testnet endpoints are
// provisioned.
// ----------------------------------------------------------------------------

import { defineChain } from 'viem';

export const ARC_CHAIN_ID = 5042002 as const;
export const ARBITRUM_CHAIN_ID = 421614 as const;

/**
 * Arc Testnet. The shape mirrors wagmi's Chain type so it can be passed
 * directly into wagmi's `chains` array via `getDefaultConfig`.
 */
export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc', symbol: 'ARC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ARC_RPC_URL ?? 'https://rpc.testnet.arc.network',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url:
        process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ??
        'https://testnet.arcscan.app',
    },
  },
  testnet: true,
});

/**
 * Map a chain id / network string to the human label the UI shows.
 * Used by the wallet card and the existing x402 unlock experience
 * (`shortNetwork` in `components/dashboard/dag-drawer-unlock.tsx`) so
 * the network naming stays consistent everywhere.
 */
export function shortNetwork(value: string | number | undefined): string {
  if (value === undefined || value === null) return 'Unknown';
  const s = String(value);
  if (s === String(ARC_CHAIN_ID) || s.includes('5042002')) return 'Arc L1';
  if (s.includes('8453')) return 'Base';
  if (s.includes('421614')) return 'Arbitrum Sepolia';
  if (s === '1' || s.includes('eip155:1')) return 'Ethereum';
  if (s === '11155111' || s.includes('11155111')) return 'Sepolia';
  return s;
}
