// frontend/lib/web3/wagmi.ts
// ----------------------------------------------------------------------------
// wagmi + RainbowKit configuration.
//
// `getDefaultConfig` from RainbowKit bundles the standard wallet
// connectors (MetaMask, Coinbase Wallet, WalletConnect v2) and the
// WalletConnect Cloud project metadata. We register Arc Testnet as the
// primary chain and Ethereum mainnet as a secondary so users on the
// "wrong network" can switch via wagmi's `useSwitchChain`.
//
// WalletConnect requires a Cloud projectId (`NEXT_PUBLIC_WC_PROJECT_ID`).
// In dev we fall back to a sentinel so the app still boots; the
// WalletConnect connector will fail at connect-time with a clear error
// in that case, but MetaMask + Coinbase Wallet continue to work.
// ----------------------------------------------------------------------------

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet } from 'wagmi/chains';
import { arcTestnet } from './chains';

function resolveProjectId(): string {
  const id = process.env.NEXT_PUBLIC_WC_PROJECT_ID;
  if (id && id.length > 0) return id;
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(
      '[wallet] NEXT_PUBLIC_WC_PROJECT_ID is not set. WalletConnect will not work. ' +
        'Get a free projectId at https://cloud.walletconnect.com and add it to .env.local. ' +
        'MetaMask and Coinbase Wallet continue to work without it.',
    );
  }
  return 'leo-dev';
}

export const wagmiConfig = getDefaultConfig({
  appName: 'TrustGraph AI',
  projectId: resolveProjectId(),
  chains: [arcTestnet, mainnet],
  // wagmi v2 supports SSR-safe hydration. Required for Next.js so the
  // server-rendered HTML and the client hydration don't disagree.
  ssr: true,
});
