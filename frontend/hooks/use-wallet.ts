// frontend/hooks/use-wallet.ts
// ----------------------------------------------------------------------------
// Thin wrapper around wagmi + RainbowKit hooks.
//
// The rest of the app shouldn't need to know about wagmi's specific hook
// names. `useWallet` exposes a single bag with the same shape everywhere,
// and `openConnectModal` lets non-wallet-card call sites (Research, DAG
// drawer) open the RainbowKit modal without rendering a `<ConnectButton />`.
//
// All hooks must run inside `<WagmiProvider>` + `<RainbowKitProvider>`, so
// this file is `'use client'` and trusts that the providers tree is set up
// in `app/providers.tsx`.
// ----------------------------------------------------------------------------

'use client';

import { useCallback } from 'react';
import {
  useAccount,
  useDisconnect,
  useEnsName,
  useSwitchChain,
} from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { ARC_CHAIN_ID } from '@/lib/web3/chains';

export interface WalletState {
  /** Connected EVM address (lowercase, checksummed by viem upstream). */
  address: string | undefined;
  /** Connected chain id (undefined when disconnected). */
  chainId: number | undefined;
  /** Connector id — "metaMask" | "coinbaseWallet" | "walletConnect" | … */
  connector: string | undefined;
  /** ENS name resolved from the connected address (null if no record). */
  ensName: string | null | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  /** True iff the connected chain is Arc Testnet. */
  isOnArc: boolean;
  /** Open RainbowKit's connect modal. No-op if already connected. */
  openConnectModal: () => void;
  /** Disconnect the active wallet. */
  disconnect: () => void;
  /** Switch the active wallet to Arc Testnet. */
  switchToArc: () => void;
}

export function useWallet(): WalletState {
  const {
    address,
    chainId,
    connector,
    isConnected,
    isConnecting,
    isReconnecting,
  } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: ensName } = useEnsName({ address });
  const { openConnectModal } = useConnectModal();

  const isOnArc = chainId === ARC_CHAIN_ID;

  const wrappedOpen = useCallback(() => {
    if (openConnectModal) openConnectModal();
  }, [openConnectModal]);

  const wrappedDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const wrappedSwitch = useCallback(() => {
    switchChain({ chainId: ARC_CHAIN_ID });
  }, [switchChain]);

  return {
    address,
    chainId,
    connector: connector?.id,
    ensName,
    isConnected,
    isConnecting: isConnecting || isSwitching,
    isReconnecting,
    isOnArc,
    openConnectModal: wrappedOpen,
    disconnect: wrappedDisconnect,
    switchToArc: wrappedSwitch,
  };
}
