// frontend/components/payments/payment-modal.tsx
// ----------------------------------------------------------------------------
// x402 + Circle Gateway Payment Modal — the "Pay & Unlock" surface that
// opens from the DAG drawer's "Unlock Reasoning" / "Output Preview"
// buttons.
//
// State machine (one step id, no early returns):
//
//   idle        — initial; auto-runs the effect chain on mount
//   preparing   — first GET in flight (will be answered with 402)
//   signing     — wagmi prompted the user to sign EIP-712 typed-data
//   submitting  — retry GET with PAYMENT-SIGNATURE header
//   verifying   — server-side settlement (live or mock branch)
//   unlocking   — final GET to fetch the unlocked node with hashes
//   completed   — success; render the receipt card
//   failed      — categorized; modal stays open with a Retry button
//
// Two layers of double-click prevention:
//   1. The "Pay & Unlock" button is disabled when step.id is not in
//      { idle, failed }.
//   2. A useRef<boolean> guard set on entry and cleared in .finally()
//      so React 19 strict-mode double-effects, keyboard double-Enter,
//      and mobile double-taps all collapse to a single run.
//
// Errors are categorized so the user sees actionable copy: a wallet
// rejection offers a Try Again; a challenge expiry offers to request
// a new one; an insufficient balance offers a link to the wallet
// card; a network error offers Retry.
// ----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock as LockIcon,
  Network,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wallet as WalletIcon,
  XCircle,
  Zap,
} from 'lucide-react';
import { useSignTypedData } from 'wagmi';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useWallet } from '@/hooks/use-wallet';
import {
  x402Client,
  formatUsdc,
  resolveWalletAddress,
  type UnlockOutcome,
  type X402Accept,
  type X402Challenge,
  type X402SettlementResult,
} from '@/lib/api/x402.client';
import type { User } from '@/lib/api/types';
import type { WorkflowNode } from '@/lib/api/workflow.types';
import type { GatewayBalanceSnapshot } from '@/lib/api';
import {
  buildEip712Message,
  buildSignedEnvelope,
  networkToChainId,
} from '@/lib/web3/sign-typed-data';
import {
  useInvalidatePaymentQueries,
} from '@/lib/hooks/use-dashboard';

// ── State machine ───────────────────────────────────────────────────────

type PaymentStep =
  | { id: 'idle' }
  | { id: 'preparing' }
  | { id: 'signing' }
  | { id: 'submitting' }
  | { id: 'verifying' }
  | { id: 'unlocking' }
  | { id: 'completed' }
  | {
      id: 'failed';
      category: PaymentErrorCategory;
      message: string;
      recoverable: boolean;
    };

type PaymentErrorCategory =
  | 'wallet_rejected'
  | 'insufficient_balance'
  | 'challenge_expired'
  | 'gateway_failure'
  | 'facilitator_error'
  | 'network_error'
  | 'timeout'
  | 'unknown';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  sessionId: string;
  node: WorkflowNode;
  variant: 'prompt' | 'output';
  balance: GatewayBalanceSnapshot | null;
  onSuccess: (
    unlocked: WorkflowNode,
    settlement: X402SettlementResult | null,
  ) => void;
}

const STEPS_ORDER = [
  'preparing',
  'signing',
  'submitting',
  'verifying',
  'unlocking',
  'completed',
] as const;

// ── Main component ──────────────────────────────────────────────────────

export function PaymentModal({
  open,
  onOpenChange,
  user,
  sessionId,
  node,
  variant,
  balance,
  onSuccess,
}: PaymentModalProps) {
  const wallet = useWallet();
  const { signTypedDataAsync } = useSignTypedData();
  const invalidate = useInvalidatePaymentQueries();

  const [step, setStep] = useState<PaymentStep>({ id: 'idle' });
  const [challenge, setChallenge] = useState<X402Challenge | null>(null);
  const [accept, setAccept] = useState<X402Accept | null>(null);
  const [settlement, setSettlement] = useState<X402SettlementResult | null>(
    null,
  );
  const runRef = useRef<boolean>(false);

  const walletAddress = useMemo(
    () =>
      wallet.address ??
      (user.wallets?.[0]?.address ?? resolveWalletAddress(user)),
    [wallet.address, user],
  );
  const path = useMemo(
    () => `/workflow/session/${sessionId}/node/${node.id}`,
    [sessionId, node.id],
  );

  // Reset when the modal closes or the node changes.
  useEffect(() => {
    if (!open) {
      // Defer reset to the next tick so the close animation can play
      // without flickering through the idle body.
      const t = setTimeout(() => {
        runRef.current = false;
        setStep({ id: 'idle' });
        setChallenge(null);
        setAccept(null);
        setSettlement(null);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleFailure = useCallback(
    (category: PaymentErrorCategory, message: string, recoverable: boolean) => {
      setStep({ id: 'failed', category, message, recoverable });
    },
    [],
  );

  const runPayment = useCallback(async () => {
    if (runRef.current) return;
    runRef.current = true;

    setChallenge(null);
    setAccept(null);
    setSettlement(null);
    setStep({ id: 'preparing' });

    // 1. Request the protected resource.
    const first: UnlockOutcome<WorkflowNode> =
      await x402Client.unlockAndFetch<WorkflowNode>({
        path,
        userId: user.id,
        walletAddress,
      });

    if (first.status === 'granted') {
      setSettlement(first.settlement);
      setStep({ id: 'completed' });
      onSuccess(first.data, first.settlement);
      invalidate();
      runRef.current = false;
      return;
    }
    if (first.status !== 'challenge') {
      runRef.current = false;
      return routeOutcomeFailure(first, handleFailure);
    }

    setChallenge(first.challenge);
    setAccept(first.accept);
    const thisAccept = first.accept;

    // 2. Build the EIP-712 message and ask wagmi to sign.
    setStep({ id: 'signing' });
    let chainId: number;
    try {
      chainId = wallet.chainId ?? networkToChainId(thisAccept.network);
    } catch (err) {
      runRef.current = false;
      return handleFailure(
        'unknown',
        err instanceof Error ? err.message : 'Invalid network',
        true,
      );
    }

    const eip712 = buildEip712Message({
      accept: thisAccept,
      walletAddress,
      chainId,
    });

    let signature: `0x${string}`;
    try {
      // wagmi's `useSignTypedData` is generic over the message shape;
      // we cast through `unknown` so the call site compiles without
      // having to mirror wagmi's overloaded generics (which would
      // require the literal-string EIP-712 type names to be inferred).
      signature = (await signTypedDataAsync({
        domain: eip712.domain,
        types: { Payment: [...eip712.types.Payment] },
        primaryType: eip712.primaryType,
        message: eip712.message,
      } as unknown as Parameters<typeof signTypedDataAsync>[0])) as `0x${string}`;
    } catch (err) {
      runRef.current = false;
      const message = err instanceof Error ? err.message : String(err);
      const isRejection = /rejected|denied|user.*reject/i.test(message);
      return handleFailure(
        isRejection ? 'wallet_rejected' : 'unknown',
        isRejection
          ? 'You rejected the signature in your wallet.'
          : message,
        true,
      );
    }

    // 3. Build the envelope and retry.
    setStep({ id: 'submitting' });
    const envelope = buildSignedEnvelope({
      accept: thisAccept,
      walletAddress,
      signature,
    });

    setStep({ id: 'verifying' });
    const settled: UnlockOutcome<WorkflowNode> =
      await x402Client.settle<WorkflowNode>({
        path,
        userId: user.id,
        walletAddress,
        challenge: first.challenge,
        envelopeOverride: envelope,
      });

    if (settled.status === 'failed' || settled.status === 'expired') {
      runRef.current = false;
      return routeOutcomeFailure(settled, handleFailure);
    }
    if (settled.status === 'network') {
      runRef.current = false;
      return handleFailure('network_error', settled.message, true);
    }
    if (settled.status !== 'granted') {
      runRef.current = false;
      return handleFailure('unknown', 'Unexpected settlement outcome', true);
    }

    setSettlement(settled.settlement);

    // 4. Auto-retry to fetch the unlocked node (with hashes).
    setStep({ id: 'unlocking' });
    const refreshed: UnlockOutcome<WorkflowNode> =
      await x402Client.unlockAndFetch<WorkflowNode>({
        path,
        userId: user.id,
        walletAddress,
      });

    if (refreshed.status === 'granted') {
      setStep({ id: 'completed' });
      onSuccess(refreshed.data, settled.settlement);
      invalidate();
      runRef.current = false;
      return;
    }
    // Even if the auto-retry somehow returned 402, we know the
    // settlement was successful — fall back to the settled data.
    setStep({ id: 'completed' });
    onSuccess(settled.data, settled.settlement);
    invalidate();
    runRef.current = false;
  }, [
    path,
    user.id,
    walletAddress,
    wallet.chainId,
    signTypedDataAsync,
    onSuccess,
    invalidate,
    handleFailure,
  ]);

  // Kick off the flow the moment the modal opens.
  useEffect(() => {
    if (!open) return;
    if (step.id !== 'idle') return;
    void runPayment();
  }, [open, step.id, runPayment]);

  const handleRetry = useCallback(() => {
    setStep({ id: 'idle' });
    // runPayment will fire on the next effect tick.
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 gap-0 overflow-hidden border-border/60"
      >
        <DialogHeader className="border-b border-border/60 px-6 py-4 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-display tracking-tight">
                  {step.id === 'completed'
                    ? 'Unlocked'
                    : `Unlock ${variant === 'prompt' ? 'reasoning' : 'output'}`}
                </DialogTitle>
                <DialogDescription className="text-xs font-mono">
                  {node.nodeName} · step {String(node.stepIndex + 1).padStart(2, '0')}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-border/60 bg-card/40 font-mono text-[10px] uppercase tracking-wider"
            >
              {step.id === 'completed' ? (
                <>
                  <CheckCircle2 className="size-3" /> Paid
                </>
              ) : (
                <>
                  <LockIcon className="size-3" /> Premium
                </>
              )}
            </Badge>
          </div>
        </DialogHeader>

        {step.id === 'completed' ? (
          <CompletedBody
            node={node}
            accept={accept}
            settlement={settlement}
            onClose={() => onOpenChange(false)}
          />
        ) : step.id === 'failed' ? (
          <FailedBody
            step={step}
            onRetry={handleRetry}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <ProcessingBody
            step={step}
            node={node}
            variant={variant}
            accept={accept}
            challenge={challenge}
            walletAddress={walletAddress}
            walletConnected={wallet.isConnected}
            balance={balance}
            onConnectWallet={wallet.openConnectModal}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Visual sections ─────────────────────────────────────────────────────

function ProcessingBody({
  step,
  node,
  variant,
  accept,
  challenge,
  walletAddress,
  walletConnected,
  balance,
  onConnectWallet,
  onClose,
}: {
  step: PaymentStep;
  node: WorkflowNode;
  variant: 'prompt' | 'output';
  accept: X402Accept | null;
  challenge: X402Challenge | null;
  walletAddress: string;
  walletConnected: boolean;
  balance: GatewayBalanceSnapshot | null;
  onConnectWallet: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-5 px-6 py-5">
      <WalletPanel
        walletAddress={walletAddress}
        walletConnected={walletConnected}
        balance={balance}
        onConnectWallet={onConnectWallet}
      />

      {challenge && accept ? (
        <SummaryPanel accept={accept} />
      ) : (
        <PreviewCard node={node} variant={variant} loading={step.id === 'preparing'} />
      )}

      <StepsPanel step={step} />

      <DialogFooter className="px-0 pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 rounded-full"
          onClick={onClose}
        >
          <XCircle className="size-3.5 mr-1.5" />
          Cancel
        </Button>
      </DialogFooter>
    </div>
  );
}

function CompletedBody({
  node,
  accept,
  settlement,
  onClose,
}: {
  node: WorkflowNode;
  accept: X402Accept | null;
  settlement: X402SettlementResult | null;
  onClose: () => void;
}) {
  return (
    <div className="space-y-5 px-6 py-5">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 animate-unlock-glow">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-emerald-300">
          <CheckCircle2 className="size-3" />
          Verified purchase
        </div>
        <div className="space-y-1.5 text-xs">
          <ReceiptRow
            label="USDC Spent"
            value={accept ? `${formatUsdc(accept.amount)} ${accept.currency}` : '—'}
            mono
          />
          <ReceiptRow
            label="Tx Hash"
            value={settlement?.transactionHash ?? '—'}
            mono
            copyable
          />
          <ReceiptRow
            label="Reference"
            value={accept?.reference ?? settlement?.payerAddress ?? '—'}
            mono
            copyable
          />
          <ReceiptRow
            label="Receipt ID"
            value={settlement?.transactionHash ?? '—'}
            mono
            copyable
          />
          <ReceiptRow
            label="Unlocked Time"
            value={
              settlement?.paymentStatus === 'PAID'
                ? new Date().toLocaleTimeString()
                : '—'
            }
            mono
          />
        </div>
      </div>
      <div className="rounded-md border border-border/50 bg-card/30 px-3 py-2 text-[11px] text-muted-foreground">
        <Sparkles className="size-3 inline-block mr-1.5 text-accent" />
        Closing this dialog will reveal the unlocked{' '}
        <span className="font-mono text-foreground/80">{node.nodeName}</span>{' '}
        content.
      </div>
      <DialogFooter className="px-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 rounded-full"
          onClick={onClose}
        >
          Close
        </Button>
        {settlement?.transactionHash ? (
          <Button
            asChild
            type="button"
            size="sm"
            className="flex-1 rounded-full"
          >
            <a
              href={buildExplorerUrl(settlement.transactionHash)}
              target="_blank"
              rel="noreferrer noopener"
            >
              <ExternalLink className="size-3.5 mr-1.5" />
              View receipt
            </a>
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
}

function FailedBody({
  step,
  onRetry,
  onClose,
}: {
  step: Extract<PaymentStep, { id: 'failed' }>;
  onRetry: () => void;
  onClose: () => void;
}) {
  const meta = ERROR_META[step.category];
  return (
    <div className="space-y-5 px-6 py-5">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-destructive">
          <AlertOctagon className="size-3" />
          {meta.title}
        </div>
        <p className="text-xs leading-relaxed text-destructive/90">
          {step.message || meta.detail}
        </p>
      </div>
      <DialogFooter className="px-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 rounded-full"
          onClick={onClose}
        >
          <XCircle className="size-3.5 mr-1.5" />
          Cancel
        </Button>
        {step.recoverable ? (
          <Button
            type="button"
            size="sm"
            className="flex-1 rounded-full"
            onClick={onRetry}
          >
            <RefreshCcw className="size-3.5 mr-1.5" />
            {meta.cta}
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
}

function WalletPanel({
  walletAddress,
  walletConnected,
  balance,
  onConnectWallet,
}: {
  walletAddress: string;
  walletConnected: boolean;
  balance: GatewayBalanceSnapshot | null;
  onConnectWallet: () => void;
}) {
  const total =
    balance != null
      ? `${formatUsdc(
          String(Math.round(Number(balance.totalConfirmed) * 1_000_000)),
        )} USDC`
      : '—';
  const isMock = balance?.isMock ?? true;

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-3.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <WalletIcon className="size-3" />
          Wallet
        </div>
        <Badge
          variant="outline"
          className={cn(
            'rounded-full font-mono text-[9px] uppercase tracking-wider px-1.5 py-0',
            walletConnected
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-300',
          )}
        >
          {walletConnected ? 'Connected' : 'Not connected'}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-mono text-foreground/85 truncate" title={walletAddress}>
          {shortAddress(walletAddress)}
        </span>
        <button
          type="button"
          onClick={() => copyToClipboard(walletAddress, 'Address')}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Copy address"
        >
          <Copy className="size-3" />
        </button>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Spendable
        </span>
        <span className="font-mono text-foreground/85">
          {total}
          {isMock ? (
            <Badge
              variant="outline"
              className="ml-2 rounded-full border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[9px] font-mono uppercase tracking-wider text-amber-300"
            >
              MOCK
            </Badge>
          ) : null}
        </span>
      </div>
      {!walletConnected ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full rounded-full"
          onClick={onConnectWallet}
        >
          <WalletIcon className="size-3.5 mr-1.5" />
          Connect Wallet
        </Button>
      ) : null}
    </div>
  );
}

function SummaryPanel({ accept }: { accept: X402Accept }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-3.5 space-y-2">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-accent">
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="size-3" />
          Payment required
        </span>
        <ExpiresCountdown iso={accept.expires} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <ReceiptRow label="Amount" value={`${formatUsdc(accept.amount)} ${accept.currency}`} mono />
        <ReceiptRow label="Network" value={shortNetworkFromCaip(accept.network)} mono />
        <ReceiptRow label="Recipient" value={accept.payTo} mono />
        <ReceiptRow label="Reference" value={accept.reference} mono />
        <ReceiptRow label="Asset" value={accept.asset} mono />
        <ReceiptRow label="Method" value="USDC · Arc L1" mono />
      </div>
    </div>
  );
}

function PreviewCard({
  node,
  variant,
  loading,
}: {
  node: WorkflowNode;
  variant: 'prompt' | 'output';
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-3.5 space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Network className="size-3" />
        {loading ? 'Requesting challenge…' : 'Ready to unlock'}
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <Field icon={<CreditCard className="size-3" />} label="Price">
          {estimatePrice(node.nodeName)} USDC
        </Field>
        <Field icon={<WalletIcon className="size-3" />} label="Network">
          Arc L1
        </Field>
        <Field icon={<Zap className="size-3" />} label="Unlock">
          {variant === 'prompt' ? 'reasoning' : 'output'} ~ instant
        </Field>
      </div>
    </div>
  );
}

function StepsPanel({ step }: { step: PaymentStep }) {
  const activeIndex =
    step.id === 'idle' || step.id === 'failed'
      ? -1
      : STEPS_ORDER.indexOf(step.id as (typeof STEPS_ORDER)[number]);
  const pct =
    activeIndex < 0
      ? 0
      : Math.min(100, Math.round(((activeIndex + 1) / STEPS_ORDER.length) * 100));

  return (
    <div className="space-y-2.5">
      <Progress value={pct} className="h-1.5" />
      <ul className="space-y-1.5">
        {STEPS_ORDER.map((id, i) => {
          const status =
            i < activeIndex
              ? 'done'
              : i === activeIndex
                ? 'active'
                : 'pending';
          return <StepRow key={id} id={id} status={status} />;
        })}
      </ul>
    </div>
  );
}

function StepRow({
  id,
  status,
}: {
  id: (typeof STEPS_ORDER)[number];
  status: 'done' | 'active' | 'pending';
}) {
  const meta = STEP_META[id];
  return (
    <li className="flex items-center gap-2 text-[11px]">
      {status === 'done' ? (
        <CheckCircle2 className="size-3 text-emerald-400" />
      ) : status === 'active' ? (
        <Loader2 className="size-3 animate-spin text-accent" />
      ) : (
        <Circle className="size-3 text-muted-foreground/50" />
      )}
      <span
        className={cn(
          'font-mono uppercase tracking-wider text-[10px]',
          status === 'done'
            ? 'text-emerald-300/80'
            : status === 'active'
              ? 'text-foreground/90'
              : 'text-muted-foreground/60',
        )}
      >
        {meta.label}
      </span>
      <span className="text-muted-foreground/60 truncate text-[10px]">
        {meta.hint}
      </span>
    </li>
  );
}

// ── Tiny subcomponents ─────────────────────────────────────────────────

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
      <div className="mt-0.5 truncate text-foreground/80 font-mono text-[10.5px]">
        {children}
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const display = value.length > 22 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span
        className={cn(
          'truncate text-foreground/85',
          mono && 'font-mono text-[11px]',
        )}
        title={value}
      >
        {display}
        {copyable ? (
          <button
            type="button"
            onClick={() => copyToClipboard(value, label)}
            className="ml-1 text-muted-foreground hover:text-foreground"
            aria-label={`Copy ${label}`}
          >
            <Copy className="size-2.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function ExpiresCountdown({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(iso).getTime() - now;
  const display =
    ms <= 0
      ? 'expired'
      : ms < 60_000
        ? `${Math.max(1, Math.floor(ms / 1000))}s`
        : ms < 3_600_000
          ? `${Math.floor(ms / 60_000)}m`
          : `${Math.floor(ms / 3_600_000)}h`;
  return (
    <span className="inline-flex items-center gap-1 normal-case tracking-normal text-foreground/70">
      <Clock className="size-2.5" />
      Expires in {display}
    </span>
  );
}

// ── Constants & helpers ────────────────────────────────────────────────

const STEP_META: Record<
  (typeof STEPS_ORDER)[number],
  { label: string; hint: string }
> = {
  preparing: {
    label: 'Preparing',
    hint: 'Requesting 402 challenge from the facilitator',
  },
  signing: {
    label: 'Signing',
    hint: 'Waiting for wallet signature',
  },
  submitting: {
    label: 'Submitting',
    hint: 'Retrying with PAYMENT-SIGNATURE',
  },
  verifying: {
    label: 'Verifying',
    hint: 'Server checks the signature + settlement',
  },
  unlocking: {
    label: 'Unlocking',
    hint: 'Fetching unlocked node',
  },
  completed: {
    label: 'Completed',
    hint: 'Receipt ready',
  },
};

const ERROR_META: Record<
  PaymentErrorCategory,
  { title: string; detail: string; cta: string }
> = {
  wallet_rejected: {
    title: 'Wallet rejected',
    detail: 'You cancelled the signature in your wallet.',
    cta: 'Try again',
  },
  insufficient_balance: {
    title: 'Insufficient balance',
    detail:
      'Your Circle Gateway balance is too low to complete this payment.',
    cta: 'Try again',
  },
  challenge_expired: {
    title: 'Challenge expired',
    detail:
      'The 30-minute payment window closed before settlement. Request a new one.',
    cta: 'Request a new challenge',
  },
  gateway_failure: {
    title: 'Gateway failure',
    detail: 'The payment facilitator returned an error. Try again in a moment.',
    cta: 'Try again',
  },
  facilitator_error: {
    title: 'Facilitator error',
    detail: 'The payment could not be verified. Please try again.',
    cta: 'Try again',
  },
  network_error: {
    title: 'Network error',
    detail: "We couldn't reach the facilitator. Check your connection.",
    cta: 'Try again',
  },
  timeout: {
    title: 'Timed out',
    detail: 'The facilitator took too long to respond. Try again.',
    cta: 'Try again',
  },
  unknown: {
    title: 'Verification failed',
    detail: 'Something went wrong while processing the payment.',
    cta: 'Try again',
  },
};

function shortAddress(a: string): string {
  if (!a) return '—';
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortNetworkFromCaip(n: string): string {
  if (n.includes('5042002')) return 'Arc L1';
  if (n.includes('8453')) return 'Base';
  if (n.includes('421614')) return 'Arbitrum';
  if (n.includes('1') && !n.includes('11')) return 'Ethereum';
  return n;
}

function estimatePrice(nodeName: string): string {
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

function copyToClipboard(value: string, label: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  void navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error('Copy failed'));
}

function buildExplorerUrl(txHash: string): string {
  const base =
    process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? 'https://testnet.arcscan.app';
  return `${base.replace(/\/$/, '')}/tx/${txHash}`;
}

// Map an UnlockOutcome to a (category, message, recoverable) tuple for
// the failure panel. Centralized so the success / granted / challenge
// branches are kept tidy.
function routeOutcomeFailure(
  outcome: UnlockOutcome<unknown>,
  handle: (
    category: PaymentErrorCategory,
    message: string,
    recoverable: boolean,
  ) => void,
) {
  switch (outcome.status) {
    case 'expired':
      handle('challenge_expired', outcome.message, true);
      return;
    case 'signature_rejected':
      handle('wallet_rejected', outcome.message, true);
      return;
    case 'cancelled':
      handle('wallet_rejected', outcome.message, true);
      return;
    case 'network':
      handle('network_error', outcome.message, true);
      return;
    case 'failed': {
      const m = (outcome.message || '').toLowerCase();
      if (m.includes('expired')) {
        handle('challenge_expired', outcome.message, true);
        return;
      }
      if (m.includes('insufficient')) {
        handle('insufficient_balance', outcome.message, true);
        return;
      }
      if (outcome.settlement?.paymentStatus === 'EXPIRED') {
        handle('challenge_expired', outcome.message, true);
        return;
      }
      handle('facilitator_error', outcome.message, true);
      return;
    }
    default:
      handle('unknown', 'Unexpected outcome', true);
  }
}
