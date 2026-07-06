// frontend/components/receipts/receipt-status-badge.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Status badges for Phase 23 Receipt Explorer.
// Reuses the badge + cn pattern established by payment-history.tsx.
// ─────────────────────────────────────────────────────────────────────────────

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PaymentEntitlementStatus } from '@/lib/api/payment.service';
import type { ReceiptVerificationStatus } from '@/lib/api/receipt.service';

// ── Payment status ───────────────────────────────────────────────────────────

const PAYMENT_META: Record<
  PaymentEntitlementStatus,
  { label: string; className: string }
> = {
  PAID: {
    label: 'Paid',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  PENDING: {
    label: 'Pending',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  UNPAID: {
    label: 'Unpaid',
    className: 'border-border/60 bg-card/40 text-muted-foreground',
  },
  FAILED: {
    label: 'Failed',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  EXPIRED: {
    label: 'Expired',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  REFUNDED: {
    label: 'Refunded',
    className: 'border-border/60 bg-card/40 text-muted-foreground',
  },
};

export function PaymentStatusBadge({
  status,
}: {
  status: PaymentEntitlementStatus;
}) {
  const meta = PAYMENT_META[status] ?? {
    label: status,
    className: 'border-border/60 bg-card/40 text-muted-foreground',
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full font-mono text-[10px] uppercase tracking-wider',
        meta.className,
      )}
    >
      {meta.label}
    </Badge>
  );
}

// ── Verification status ───────────────────────────────────────────────────────

const VERIFICATION_META: Record<
  ReceiptVerificationStatus,
  { label: string; className: string }
> = {
  verified: {
    label: 'Verified',
    className: 'border-primary/40 bg-primary/10 text-primary',
  },
  pending: {
    label: 'Pending',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  },
  failed: {
    label: 'Failed',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
  unverified: {
    label: 'Unverified',
    className: 'border-border/60 bg-card/40 text-muted-foreground',
  },
};

export function VerificationStatusBadge({
  status,
}: {
  status: ReceiptVerificationStatus;
}) {
  const meta = VERIFICATION_META[status] ?? {
    label: status,
    className: 'border-border/60 bg-card/40 text-muted-foreground',
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full font-mono text-[10px] uppercase tracking-wider',
        meta.className,
      )}
    >
      {meta.label}
    </Badge>
  );
}

// ── On-chain badge ────────────────────────────────────────────────────────────

export function OnChainBadge({ anchored }: { anchored: boolean }) {
  if (!anchored) return null;
  return (
    <Badge
      variant="outline"
      className="rounded-full font-mono text-[10px] uppercase tracking-wider border-accent/40 bg-accent/10 text-accent"
    >
      On-chain
    </Badge>
  );
}
