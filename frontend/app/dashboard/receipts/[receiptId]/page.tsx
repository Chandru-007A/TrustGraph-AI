// frontend/app/dashboard/receipts/[receiptId]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 23 — Receipt Detail Page: full blockchain receipt explorer view.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Blocks,
  CircleDollarSign,
  ExternalLink,
  Receipt,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useReceiptDetail } from '@/lib/hooks/use-dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/brand/logo';
import { Spinner } from '@/components/ui/spinner';
import { CopyField } from '@/components/receipts/copy-field';
import { ReceiptTimeline } from '@/components/receipts/receipt-timeline';
import { ReceiptDownload } from '@/components/receipts/receipt-download';
import {
  PaymentStatusBadge,
  VerificationStatusBadge,
  OnChainBadge,
} from '@/components/receipts/receipt-status-badge';

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
      <header className="flex items-center gap-2.5 border-b border-border/60 px-5 py-4">
        <div className="flex size-7 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
          {icon}
        </div>
        <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
      </header>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2 py-2.5 border-b border-border/40 last:border-0">
      <dt className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground pt-0.5">
        {label}
      </dt>
      <dd className="text-sm text-foreground/90">{children}</dd>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReceiptDetailPage() {
  const router = useRouter();
  const params = useParams();
  const receiptId = typeof params.receiptId === 'string' ? params.receiptId : '';

  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?next=/dashboard/receipts/${receiptId}`);
    }
  }, [authLoading, isAuthenticated, router, receiptId]);

  const { data: receipt, isLoading, isError, error } = useReceiptDetail(receiptId);

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full gap-1.5"
          onClick={() => router.push('/dashboard/receipts')}
        >
          <ArrowLeft className="size-3.5" />
          All Receipts
        </Button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-4 pb-24">
        {/* Breadcrumb */}
        <div className="mb-6">
          <p className="text-xs font-mono text-muted-foreground mb-1">
            Dashboard /{' '}
            <Link
              href="/dashboard/receipts"
              className="hover:text-foreground transition-colors"
            >
              Receipts
            </Link>{' '}
            / {receiptId ? receiptId.slice(0, 12) + '…' : '—'}
          </p>
        </div>

        {/* Error states */}
        {isError && (
          <ErrorState
            message={error instanceof Error ? error.message : 'Failed to load receipt'}
            onBack={() => router.push('/dashboard/receipts')}
          />
        )}

        {!isError && !receipt && !isLoading && (
          <ErrorState message="Receipt not found" onBack={() => router.push('/dashboard/receipts')} />
        )}

        {receipt && (
          <>
            {/* ── Page header ─────────────────────────────────────── */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-2xl lg:text-3xl font-display tracking-tight">
                    Receipt
                  </h1>
                  <PaymentStatusBadge status={receipt.paymentStatus} />
                  <VerificationStatusBadge status={receipt.verificationStatus} />
                  {receipt.blockchain?.txHash && <OnChainBadge anchored />}
                </div>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {receipt.id}
                </p>
              </div>
              <ReceiptDownload receipt={receipt} />
            </div>

            {/* ── Two-column grid ─────────────────────────────────── */}
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Receipt Info */}
              <Section icon={<Receipt className="size-3.5" />} title="Receipt Information">
                <dl>
                  <InfoRow label="Receipt ID">
                    <code className="text-[11px] font-mono break-all select-all">
                      {receipt.id}
                    </code>
                  </InfoRow>
                  <InfoRow label="Created">
                    {new Date(receipt.createdAt).toLocaleString()}
                  </InfoRow>
                  <InfoRow label="Updated">
                    {new Date(receipt.updatedAt).toLocaleString()}
                  </InfoRow>
                </dl>
              </Section>

              {/* Workflow Info */}
              <Section icon={<Workflow className="size-3.5" />} title="Workflow Information">
                <dl>
                  <InfoRow label="Workflow ID">
                    <span className="flex items-center gap-1">
                      <code className="text-[11px] font-mono break-all">
                        {receipt.workflowId}
                      </code>
                      <Link
                        href={`/dashboard/${receipt.workflowId}`}
                        className="text-accent hover:underline ml-1 shrink-0"
                        title="Open workflow"
                      >
                        <ExternalLink className="size-3" />
                      </Link>
                    </span>
                  </InfoRow>
                  {receipt.workflowName && (
                    <InfoRow label="Workflow Name">
                      <span className="text-sm">{receipt.workflowName}</span>
                    </InfoRow>
                  )}
                  <InfoRow label="Node ID">
                    <code className="text-[11px] font-mono break-all">
                      {receipt.nodeId}
                    </code>
                  </InfoRow>
                  {receipt.nodeName && (
                    <InfoRow label="Node Name">
                      <Badge
                        variant="outline"
                        className="rounded-full font-mono text-[10px]"
                      >
                        {receipt.nodeName}
                      </Badge>
                    </InfoRow>
                  )}
                </dl>
              </Section>

              {/* Payment Info */}
              <Section icon={<CircleDollarSign className="size-3.5" />} title="Payment Information">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        Amount
                      </p>
                      <p className="text-lg font-semibold">
                        {receipt.amount}{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                          {receipt.currency}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        Status
                      </p>
                      <PaymentStatusBadge status={receipt.paymentStatus} />
                    </div>
                  </div>

                  <CopyField
                    label="Wallet Address"
                    value={receipt.walletAddress}
                    truncate
                  />
                  <CopyField
                    label="Payment Reference"
                    value={receipt.paymentReference}
                    truncate
                  />

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {receipt.paidAt && (
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                          Paid At
                        </p>
                        <p className="text-sm">
                          {new Date(receipt.paidAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {receipt.connector && (
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                          Connector
                        </p>
                        <Badge
                          variant="outline"
                          className="rounded-full font-mono text-[10px]"
                        >
                          {receipt.connector}
                        </Badge>
                      </div>
                    )}
                    {receipt.gatewayStatus && (
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                          Gateway Status
                        </p>
                        <p className="text-sm font-mono">{receipt.gatewayStatus}</p>
                      </div>
                    )}
                    {receipt.x402Reference && (
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                          x402 Reference
                        </p>
                        <code className="text-[11px] font-mono break-all">
                          {receipt.x402Reference}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              {/* Blockchain Info */}
              <Section icon={<Blocks className="size-3.5" />} title="Blockchain Information">
                <div className="space-y-3">
                  <CopyField
                    label="Transaction Hash"
                    value={receipt.blockchain?.txHash ?? receipt.txHash}
                    truncate
                    href={receipt.blockchain?.explorerUrl ?? undefined}
                  />
                  <CopyField
                    label="Merkle Root"
                    value={receipt.blockchain?.merkleRoot ?? receipt.merkleRoot}
                    truncate
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        Network
                      </p>
                      <p className="text-sm font-mono">
                        {receipt.blockchain?.network ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        Block Number
                      </p>
                      <p className="text-sm font-mono">
                        {receipt.blockchain?.blockNumber ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        Confirmations
                      </p>
                      <p className="text-sm font-mono">
                        {receipt.blockchain?.confirmations ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        Registry ID
                      </p>
                      <code className="text-[11px] font-mono break-all">
                        {receipt.blockchain?.registryId ?? '—'}
                      </code>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                      Verification Status
                    </p>
                    <VerificationStatusBadge status={receipt.verificationStatus} />
                  </div>

                  {/* Explorer buttons */}
                  {receipt.blockchain?.explorerUrl && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <ExplorerButton
                        href={receipt.blockchain.explorerUrl}
                        label="View Transaction"
                      />
                      {receipt.blockchain.blockNumber && (
                        <ExplorerButton
                          href={receipt.blockchain.explorerUrl.replace(
                            /\/tx\/.*/,
                            `/block/${receipt.blockchain.blockNumber}`,
                          )}
                          label="View Block"
                        />
                      )}
                      {receipt.blockchain.registryId && (
                        <ExplorerButton
                          href={receipt.blockchain.explorerUrl.replace(
                            /\/tx\/.*/,
                            `/address/${receipt.blockchain.registryId}`,
                          )}
                          label="View Receipt"
                        />
                      )}
                    </div>
                  )}
                </div>
              </Section>
            </div>

            {/* ── Verification section ─────────────────────────────── */}
            <div className="mt-5">
              <Section icon={<ShieldCheck className="size-3.5" />} title="Verification Information">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                      Status
                    </p>
                    <VerificationStatusBadge status={receipt.verificationStatus} />
                  </div>
                  {receipt.merkleRoot && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                        Merkle Root
                      </p>
                      <CopyField
                        label=""
                        value={receipt.merkleRoot}
                        truncate={false}
                      />
                    </div>
                  )}
                </div>
              </Section>
            </div>

            {/* ── Activity timeline ────────────────────────────────── */}
            {receipt.timeline && receipt.timeline.length > 0 && (
              <div className="mt-5">
                <Section
                  icon={<Activity className="size-3.5" />}
                  title="Activity Timeline"
                >
                  <ReceiptTimeline events={receipt.timeline} />
                </Section>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ExplorerButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-card/40 text-xs font-mono text-foreground/80 hover:text-accent hover:border-accent/40 transition-colors"
    >
      <ExternalLink className="size-3" />
      {label}
    </a>
  );
}

function ErrorState({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="glass-strong rounded-2xl border border-border/60 p-12 text-center">
      <Receipt className="size-10 text-muted-foreground/40 mx-auto mb-4" />
      <h2 className="text-lg font-medium text-foreground mb-2">
        {message}
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        The receipt may not exist or you may not have permission to view it.
      </p>
      <Button variant="outline" size="sm" className="rounded-full" onClick={onBack}>
        <ArrowLeft className="size-3.5 mr-1.5" />
        Back to Receipts
      </Button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-1/2" />
      <div className="grid lg:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
