// frontend/components/dashboard/dag-drawer-unlock.tsx
// ─────────────────────────────────────────────────────────────────────────────
// x402 Unlock trigger for the DAG drawer's premium content slots
// (Prompt and Output Preview) — cinematic edition.
//
// Owns the locked card chrome (price/network/unlock preview + Unlock /
// Connect Wallet buttons) and the success early-return. The full
// multi-step state machine (challenge → sign → settle → verify →
// unlock) lives in <PaymentModal> as a shadcn Dialog.
//
// Visual contract (cinematic):
//   • Locked card — gradient border + animated top hairline + pulsing lock
//   • Price / Network / Unlock fields with motion hover-lift
//   • Primary button with motion tap scale
//   • On success, the unlocked children are revealed inside a
//     `motion.div` that plays a 1.0-second unlock sequence: border
//     sweep, particle burst, and a glow-pulse-twice. The success
//     children themselves fade in with a small delay so the sweep
//     lands first.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useMemo, useState } from 'react';
import {
  CreditCard,
  Lock,
  Wallet,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
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

// 12 deterministic particle vectors — keyed off the variant so the
// burst shape is stable between renders. Pure CSS via --tx/--ty
// custom properties on `.particle-dot`.
const PARTICLE_VECTORS: { tx: number; ty: number }[] = [
  { tx: -90, ty: -50 },
  { tx: -70, ty: -90 },
  { tx: -30, ty: -110 },
  { tx: 10, ty: -120 },
  { tx: 50, ty: -100 },
  { tx: 90, ty: -60 },
  { tx: 110, ty: -10 },
  { tx: 100, ty: 40 },
  { tx: 60, ty: 90 },
  { tx: 0, ty: 110 },
  { tx: -50, ty: 80 },
  { tx: -100, ty: 20 },
];

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

  // ── Success early return ─ unlock sequence + unlocked children ─────
  if (state.status === 'success') {
    return (
      <motion.div
        key="unlocked"
        className="relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* Layer 1: glow ring pulses twice (behind everything) */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-2 rounded-lg animate-glow-pulse-twice"
        />

        {/* Layer 2: border light sweep across the unlocked area */}
        <div aria-hidden className="pointer-events-none animate-border-sweep" />

        {/* Layer 3: 12 emerald particles burst outward */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {PARTICLE_VECTORS.map((v, i) => (
            <span
              key={i}
              className="particle-dot"
              style={
                {
                  top: '50%',
                  left: '50%',
                  // The CSS `unlock-particle` keyframe reads these
                  // to translate to the final position.
                  '--tx': `${v.tx}px`,
                  '--ty': `${v.ty}px`,
                  animationDelay: `${i * 30}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Layer 4: the actual unlocked children, reveal after the sweep */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {children({ node: state.data, settlement: state.settlement })}
        </motion.div>
      </motion.div>
    );
  }

  const title = variant === 'prompt' ? 'Premium Reasoning' : 'Output Preview';
  const subtitle =
    variant === 'prompt'
      ? 'This reasoning trace is protected using x402 micropayments.'
      : 'The full agent output is protected using x402 micropayments.';

  return (
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className={cn(
          'relative overflow-hidden rounded-lg p-px',
          // Gradient border via the existing utility
          'gradient-border',
        )}
      >
        {/* Animated hairline at the top edge */}
        <div aria-hidden className="animate-hairline" />

        {/* Glow blob behind the lock icon */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-accent/15 blur-2xl"
        />

        <div className="rounded-[calc(var(--radius-lg)-1px)] bg-gradient-to-br from-accent/5 via-background/40 to-background/30 px-3.5 py-3">
          <div className="flex items-start gap-2.5">
            <motion.div
              whileHover={{ scale: 1.06 }}
              className="flex size-8 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent"
            >
              <Lock className="size-4 animate-unlock-pulse" />
            </motion.div>
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
              <UnlockField
                icon={<CreditCard className="size-3" />}
                label="Price"
              >
                {estimatePrice(node.nodeName)} USDC
              </UnlockField>
              <UnlockField
                icon={<Wallet className="size-3" />}
                label="Network"
              >
                Arc L1
              </UnlockField>
              <UnlockField
                icon={<Zap className="size-3" />}
                label="Unlock"
              >
                ~ instant
              </UnlockField>
            </div>
            {wallet.isConnected ? (
              <DialogTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                >
                  <Button
                    type="button"
                    size="sm"
                    className="w-full rounded-full"
                  >
                    <Lock className="size-3.5 mr-1.5" />
                    Unlock Reasoning
                  </Button>
                </motion.div>
              </DialogTrigger>
            ) : (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              >
                <Button
                  type="button"
                  size="sm"
                  className="w-full rounded-full"
                  onClick={wallet.openConnectModal}
                >
                  <Wallet className="size-3.5 mr-1.5" />
                  Connect Wallet
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

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

function UnlockField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 360, damping: 20 }}
      className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5 cursor-default"
    >
      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-foreground/80 font-mono">
        {children}
      </div>
    </motion.div>
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
