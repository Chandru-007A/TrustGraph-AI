// frontend/components/dashboard/dag-drawer-unlock.tsx
// ─────────────────────────────────────────────────────────────────────────────
// x402 Unlock trigger for the DAG drawer's premium content slots
// (Prompt and Output Preview).
//
// In Phase 22 this file is intentionally thin: it owns the locked card
// chrome (the price/network/unlock preview + the "Unlock Reasoning" /
// "Connect Wallet" buttons) and the success early-return. The
// full multi-step state machine (challenge → sign → settle → verify →
// unlock) moved into <PaymentModal> as a shadcn Dialog.
//
// Visual contract (preserved from Phase 21):
//   • Locked card with 🔒, "Premium Reasoning" / "Output Preview" title
//   • Price / Network / Unlock preview fields
//   • "Unlock Reasoning" or "Connect Wallet" CTA
//
// On success, the children-as-function slot renders the unlocked
// content (UnlockedPrompt / UnlockedOutput in dag-drawer.tsx).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useMemo, useState } from 'react';
import {
  CreditCard,
  Lock,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import { useUnifiedBalance, useInvalidatePaymentQueries } from '@/lib/hooks/use-dashboard';
import { resolveWalletAddress } from '@/lib/api/x402.client';
import type { User } from '@/lib/api/types';
import type { WorkflowNode } from '@/lib/api/workflow.types';
import type { X402SettlementResult } from '@/lib/api/types';
import { PaymentModal } from '@/components/payments/payment-modal';

type UnlockState =
  | { status: 'idle' }
  | {
      status: 'success';
      data: WorkflowNode;
      settlement: X402SettlementResult | null;
    };

interface DagDrawerUnlockProps {
  /** The authenticated user — used to resolve the wallet address. */
  user: User;
  /** The session that owns the node we want to unlock. */
  sessionId: string;
  /** The node we want to unlock. */
  node: WorkflowNode;
  /**
   * The premium content title shown on the locked card.
   * "prompt" → "Premium Reasoning", "output" → "Output Preview".
   */
  variant: 'prompt' | 'output';
  /**
   * Children-as-function: invoked when the unlock succeeds. Receives
   * the unlocked WorkflowNode and the settlement so the caller can
   * render Prompt / Output / Reasoning / Evidence as it sees fit.
   */
  children: (args: {
    node: WorkflowNode;
    settlement: X402SettlementResult | null;
  }) => React.ReactNode;
}

export function DagDrawerUnlock({
  user,
  sessionId,
  node,
  variant,
  children,
}: DagDrawerUnlockProps) {
  const [state, setState] = useState<UnlockState>({ status: 'idle' });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const wallet = useWallet();
  const balanceQuery = useUnifiedBalance();
  const invalidate = useInvalidatePaymentQueries();

  const walletAddress = useMemo(
    () => wallet.address ?? resolveWalletAddress(user),
    [wallet.address, user],
  );

  // ── Success early return — parent renders unlocked content ─────────
  if (state.status === 'success') {
    return <>{children({ node: state.data, settlement: state.settlement })}</>;
  }

  const title = variant === 'prompt' ? 'Premium Reasoning' : 'Output Preview';
  const subtitle =
    variant === 'prompt'
      ? 'This reasoning trace is protected using x402 micropayments.'
      : 'The full agent output is protected using x402 micropayments.';

  return (
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border border-dashed',
          'border-accent/30 bg-gradient-to-br from-accent/5 via-background/40 to-background/30',
          'px-3.5 py-3 transition-all duration-300',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-accent/10 blur-2xl"
        />

        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
            <Lock className="size-4 animate-unlock-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-accent">
                Premium
              </span>
            </div>
            <h4 className="mt-0.5 text-sm font-medium text-foreground/90">
              {title}
            </h4>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <Field icon={<CreditCard className="size-3" />} label="Price">
              {estimatePrice(node.nodeName)} USDC
            </Field>
            <Field icon={<Wallet className="size-3" />} label="Network">
              Arc L1
            </Field>
            <Field icon={<Zap className="size-3" />} label="Unlock">
              ~ instant
            </Field>
          </div>
          {wallet.isConnected ? (
            <DialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-full"
              >
                <Lock className="size-3.5 mr-1.5" />
                Unlock Reasoning
              </Button>
            </DialogTrigger>
          ) : (
            <Button
              type="button"
              size="sm"
              className="w-full rounded-full"
              onClick={wallet.openConnectModal}
            >
              <Wallet className="size-3.5 mr-1.5" />
              Connect Wallet
            </Button>
          )}
        </div>
      </div>

      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        user={user}
        sessionId={sessionId}
        node={node}
        variant={variant}
        balance={balanceQuery.data ?? null}
        onSuccess={(unlocked, settlement) => {
          setPaymentOpen(false);
          setState({ status: 'success', data: unlocked, settlement });
          invalidate();
        }}
      />
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-foreground/80 font-mono">
        {children}
      </div>
    </div>
  );
}

function estimatePrice(nodeName: string): string {
  // Mirror x402.service.ts::getNodePriceAndAtomic pricing table.
  const map: Record<string, number> = {
    PlannerNode: 0.001,
    ResearchNode: 0.002,
    SourceCollectionNode: 0.002,
    ValidationNode: 0.002,
    ReasoningNode: 0.005,
    EvidenceAggregatorNode: 0.003,
    WorkflowRecorderNode: 0.001,
  };
  return String(map[nodeName] ?? 0.001);
}
