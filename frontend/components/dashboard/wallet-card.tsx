// frontend/components/dashboard/wallet-card.tsx
// ----------------------------------------------------------------------------
// Dashboard card that owns the wallet connection surface. Three states:
//
//   1. disconnected  → big "Connect Wallet" CTA that opens the RainbowKit
//                      modal. No status row.
//   2. wrong-network → amber/destructive panel with a "Switch to Arc L1"
//                      button. Address + connector still shown so the user
//                      can copy while they sort the chain out.
//   3. connected     → truncated address, ENS (if any), chain name, a
//                      Copy / Disconnect action row, and a BalanceCard
//                      showing the Circle Gateway Unified Balance.
//
// The visual contract matches `ProfileCard` / `BlockchainStatusCard`:
// `glass-strong rounded-2xl p-6 border border-border/60`.
// ----------------------------------------------------------------------------

'use client';

import { useState } from 'react';
import { Copy, LogOut, Wallet as WalletIcon, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useWallet } from '@/hooks/use-wallet';
import { shortNetwork } from '@/lib/web3/chains';
import {
  useGatewayStatus,
  useUnifiedBalance,
} from '@/lib/hooks/use-dashboard';
import { BalanceCard } from '@/components/payments/balance-card';
import { cn } from '@/lib/utils';

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'text-sm text-foreground/90 truncate max-w-[260px]',
          mono && 'font-mono text-xs',
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function shortAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function WalletCard({ className }: { className?: string }) {
  const {
    address,
    chainId,
    connector,
    ensName,
    isConnected,
    isConnecting,
    isReconnecting,
    isOnArc,
    openConnectModal,
    disconnect,
    switchToArc,
  } = useWallet();

  const [copying, setCopying] = useState(false);

  // Phase 22: pull the Circle Gateway status + unified balance so the
  // balance card embedded below the address row can show the live
  // spendable USDC total + LIVE/MOCK badge.
  const gatewayStatus = useGatewayStatus();
  const balanceQuery = useUnifiedBalance({ walletAddress: address ?? undefined });

  const handleCopy = async () => {
    if (!address) return;
    try {
      setCopying(true);
      await navigator.clipboard.writeText(address);
      toast.success('Address copied');
    } catch {
      toast.error('Could not copy address');
    } finally {
      setCopying(false);
    }
  };

  // ── Disconnected ────────────────────────────────────────────────────────
  if (!isConnected) {
    const isBusy = isConnecting || isReconnecting;
    return (
      <div className={cn('glass-strong rounded-2xl p-6 border border-border/60', className)}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
              <WalletIcon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
                Wallet
              </div>
              <div className="text-base font-medium text-foreground">Not connected</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-card/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            Disconnected
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
          Connect a wallet to start research workflows and unlock verified reasoning.
        </p>

        <Button
          variant="default"
          size="sm"
          className="w-full rounded-full"
          disabled={isBusy}
          onClick={openConnectModal}
        >
          <WalletIcon className="w-3.5 h-3.5" />
          {isBusy ? 'Opening…' : 'Connect Wallet'}
        </Button>
      </div>
    );
  }

  // ── Connected (with optional wrong-network banner) ─────────────────────
  return (
    <div className={cn('glass-strong rounded-2xl p-6 border border-border/60', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
            <WalletIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Wallet
            </div>
            <div className="text-base font-medium text-foreground">
              {ensName || shortAddress(address!)}
            </div>
          </div>
        </div>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-wider',
            isOnArc
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300',
          )}
        >
          <span
            className={cn(
              'inline-block w-1.5 h-1.5 rounded-full',
              isOnArc ? 'bg-emerald-400' : 'bg-amber-400',
            )}
          />
          {isOnArc ? 'Connected' : 'Wrong network'}
        </div>
      </div>

      {!isOnArc && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90 leading-relaxed">
          <div className="font-medium mb-1.5">Switch to Arc L1</div>
          <p className="text-amber-200/70 mb-2.5">
            Workflows settle on Arc Testnet. Switch networks in your wallet to continue.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
            onClick={switchToArc}
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Switch to Arc L1
          </Button>
        </div>
      )}

      <dl className="space-y-2.5">
        <Field
          label="Address"
          value={
            <span className="inline-flex items-center gap-1.5">
              {shortAddress(address!)}
              {ensName && (
                <span className="text-muted-foreground/70">({ensName})</span>
              )}
            </span>
          }
          mono
        />
        <Field label="Network" value={shortNetwork(chainId)} />
        <Field
          label="Connector"
          value={connector ? connector.replace(/([A-Z])/g, ' $1').trim() : '—'}
        />
      </dl>

      <Separator className="my-4" />

      <BalanceCard
        snapshot={balanceQuery.data ?? null}
        isLoading={balanceQuery.isPending || balanceQuery.isFetching}
        isError={balanceQuery.isError}
        isMock={
          (gatewayStatus.data?.mode === 'MOCK') ||
          (balanceQuery.data?.isMock ?? true)
        }
        onRefresh={() => {
          void balanceQuery.refetch();
        }}
        className="mb-5"
      />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-full"
          onClick={handleCopy}
          disabled={copying}
        >
          <Copy className="w-3.5 h-3.5" />
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-full"
          onClick={() => {
            disconnect();
            toast.success('Wallet disconnected');
          }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}

export function WalletCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('glass-strong rounded-2xl p-6 border border-border/60', className)}>
      <div className="flex items-center gap-3 mb-6">
        <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
          <WalletIcon className="w-4 h-4 text-muted-foreground" />
        </div>
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
