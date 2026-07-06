// frontend/app/dashboard/verification/[workflowId]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — Verification Center: full detail page for a workflow session.
// 10 sections: Workflow, Merkle Tree, Merkle Proof, Hash Verification,
// Blockchain, Receipt, Timeline, Verify Again, Compare Roots, Security.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  Blocks,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ExternalLink,
  GitBranch,
  Hash,
  Loader2,
  RefreshCw,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  Workflow,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import {
  useVerificationDetail,
  useVerifyWorkflow,
} from '@/lib/hooks/use-dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Logo } from '@/components/brand/logo';
import { Spinner } from '@/components/ui/spinner';
import { CopyField } from '@/components/receipts/copy-field';
import { VerificationStatusBadge, IntegrityScore } from '@/components/verification/verification-status-badge';
import { MerkleTreeVisualizer } from '@/components/verification/merkle-tree-visualizer';
import { MerkleProofPanel } from '@/components/verification/merkle-proof-panel';
import { HashComparison } from '@/components/verification/hash-comparison';
import { VerificationTimeline } from '@/components/verification/verification-timeline';
import { RootComparison } from '@/components/verification/root-comparison';
import type { NodeVerificationResult, StoredMerkleProof } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  id,
  icon,
  title,
  badge,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
      <header
        className={cn(
          'flex items-center gap-2.5 border-b border-border/60 px-5 py-4',
          collapsible && 'cursor-pointer select-none hover:bg-muted/10 transition-colors',
        )}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex size-7 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
          {icon}
        </div>
        <span className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex-1">
          {title}
        </span>
        {badge}
        {collapsible && (
          open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </header>
      {(!collapsible || open) && <div className="p-5">{children}</div>}
    </div>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-2 py-2.5 border-b border-border/40 last:border-0">
      <dt className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground pt-0.5">
        {label}
      </dt>
      <dd className="text-sm text-foreground/90 min-w-0">{children}</dd>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VerificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId =
    typeof params.workflowId === 'string' ? params.workflowId : '';

  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?next=/dashboard/verification/${sessionId}`);
    }
  }, [authLoading, isAuthenticated, router, sessionId]);

  const { data: detail, isLoading, isError, error } = useVerificationDetail(sessionId);
  const verifyMutation = useVerifyWorkflow(sessionId);

  const [selectedProof, setSelectedProof] = useState<StoredMerkleProof | null>(null);
  const [liveReport, setLiveReport] = useState<NodeVerificationResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    integrityScore: number;
    overallResult: string;
  } | null>(null);

  async function handleVerifyAgain() {
    try {
      const report = await verifyMutation.mutateAsync();
      setVerifyResult({
        success: report.overallResult === 'VERIFIED',
        integrityScore: report.integrityScore,
        overallResult: report.overallResult,
      });
      toast.success(
        report.overallResult === 'VERIFIED'
          ? '✓ Workflow verified — all nodes intact'
          : '⚠ Verification failed — check results',
      );
    } catch (err) {
      toast.error('Verification error', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    );
  }

  const report = detail?.integrityReport as Record<string, unknown> | null;
  const overallResult = (verifyResult?.overallResult ?? report?.overallResult ?? 'INCOMPLETE') as string;
  const integrityScore = verifyResult?.integrityScore ?? (report?.integrityScore as number) ?? 0;

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <Button
          variant="ghost" size="sm" className="rounded-full gap-1.5"
          onClick={() => router.push('/dashboard/verification')}
        >
          <ArrowLeft className="size-3.5" />
          All Verifications
        </Button>
      </header>

      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-4 pb-24 space-y-5">
        {/* Breadcrumb */}
        <div>
          <p className="text-xs font-mono text-muted-foreground">
            Dashboard /{' '}
            <Link href="/dashboard/verification" className="hover:text-foreground transition-colors">
              Verification
            </Link>{' '}
            / {sessionId ? sessionId.slice(0, 12) + '…' : '—'}
          </p>
        </div>

        {/* Error states */}
        {isError && (
          <ErrorCard
            message={error instanceof Error ? error.message : 'Failed to load verification'}
            onBack={() => router.push('/dashboard/verification')}
          />
        )}

        {!isError && !detail && !isLoading && (
          <ErrorCard
            message="Workflow not found"
            onBack={() => router.push('/dashboard/verification')}
          />
        )}

        {detail && (
          <>
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-2xl lg:text-3xl font-display tracking-tight">
                    Verification
                  </h1>
                  <VerificationStatusBadge result={overallResult} />
                  {integrityScore > 0 && <IntegrityScore score={integrityScore} />}
                </div>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {sessionId}
                </p>
              </div>
              <Button
                onClick={handleVerifyAgain}
                disabled={verifyMutation.isPending}
                className="rounded-full gap-2 shrink-0"
                size="sm"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Verify Again
              </Button>
            </div>

            {/* Live verify result banner */}
            {verifyResult && (
              <div
                className={cn(
                  'flex items-center gap-3 p-4 rounded-2xl border',
                  verifyResult.success
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-destructive/40 bg-destructive/5',
                )}
              >
                {verifyResult.success ? (
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                ) : (
                  <XCircle className="size-5 text-destructive shrink-0" />
                )}
                <div>
                  <p className={cn('text-sm font-semibold', verifyResult.success ? 'text-primary' : 'text-destructive')}>
                    {verifyResult.success
                      ? `Verification passed — integrity score ${verifyResult.integrityScore}%`
                      : `Verification failed — ${verifyResult.overallResult}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Live result · {new Date().toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}

            {/* ── SECTION 1: WORKFLOW ───────────────────────────────────── */}
            <Section id="workflow" icon={<Workflow className="size-3.5" />} title="Workflow Summary">
              <dl>
                <InfoRow label="Session ID">
                  <code className="text-[11px] font-mono break-all select-all">{detail.sessionId}</code>
                </InfoRow>
                <InfoRow label="Workflow ID">
                  <code className="text-[11px] font-mono break-all">{detail.workflowId}</code>
                </InfoRow>
                <InfoRow label="Status">
                  <Badge variant="outline" className="rounded-full font-mono text-[10px]">
                    {detail.status}
                  </Badge>
                </InfoRow>
                <InfoRow label="Created">
                  {new Date(detail.createdAt).toLocaleString()}
                </InfoRow>
                <InfoRow label="Last Updated">
                  {new Date(detail.updatedAt).toLocaleString()}
                </InfoRow>
                <InfoRow label="Total Nodes">
                  <span className="font-mono">{detail.totalNodes}</span>
                </InfoRow>
                <InfoRow label="Completed Nodes">
                  <span className="font-mono">{detail.completedNodes}</span>
                  {detail.totalNodes > 0 && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({Math.round((detail.completedNodes / detail.totalNodes) * 100)}%)
                    </span>
                  )}
                </InfoRow>
              </dl>
            </Section>

            {/* ── SECTION 2: MERKLE TREE ─────────────────────────────────── */}
            <Section
              id="merkle-tree"
              icon={<GitBranch className="size-3.5" />}
              title="Merkle Tree"
              collapsible
              defaultOpen={!!detail.merkle}
              badge={
                detail.merkle ? (
                  <Badge variant="outline" className="rounded-full font-mono text-[10px] border-primary/30 bg-primary/5 text-primary">
                    {detail.merkle.leafCount} leaves
                  </Badge>
                ) : undefined
              }
            >
              {detail.merkle ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3 text-sm mb-3">
                    <StatCard label="Leaf Count" value={String(detail.merkle.leafCount)} />
                    <StatCard label="Tree Depth" value={String(detail.merkle.treeDepth)} />
                    <StatCard label="Algorithm" value={detail.merkle.algorithm} />
                  </div>
                  <CopyField label="Merkle Root" value={detail.merkle.rootHash} />
                  <MerkleTreeVisualizer
                    tree={detail.merkle}
                    onLeafClick={(hash) => {
                      const proof = detail.merkle?.proofs.find((p) => p.leafHash === hash);
                      setSelectedProof(proof ?? null);
                    }}
                    className="mt-2"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Merkle tree not yet generated for this session.
                </p>
              )}
            </Section>

            {/* ── SECTION 3: MERKLE PROOF ────────────────────────────────── */}
            <Section
              id="merkle-proof"
              icon={<Hash className="size-3.5" />}
              title="Merkle Proof"
              collapsible
              defaultOpen={!!selectedProof || !!(detail.merkle?.proofs?.length)}
            >
              {(selectedProof ?? detail.merkle?.proofs?.[0]) ? (
                <div className="space-y-3">
                  {detail.merkle && detail.merkle.proofs.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 pb-2 border-b border-border/40">
                      {detail.merkle.proofs.map((p, i) => (
                        <button
                          key={p.proofId}
                          onClick={() => setSelectedProof(p)}
                          className={cn(
                            'px-2 py-1 rounded-md border text-[10px] font-mono transition-colors',
                            (selectedProof?.proofId ?? detail.merkle?.proofs[0]?.proofId) === p.proofId
                              ? 'border-accent/50 bg-accent/10 text-accent'
                              : 'border-border/40 bg-card/30 text-muted-foreground hover:text-foreground',
                          )}
                        >
                          Node {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  <MerkleProofPanel
                    proof={(selectedProof ?? detail.merkle!.proofs[0]) as StoredMerkleProof}
                    storedRoot={detail.merkle?.rootHash ?? ''}
                    isVerified={!!detail.merkle && detail.integrityReport !== null && (detail.integrityReport as Record<string, unknown>).isMerkleRootValid === true}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No Merkle proofs available. Build the Merkle tree first.
                </p>
              )}
            </Section>

            {/* ── SECTION 4: HASH VERIFICATION ──────────────────────────── */}
            <Section
              id="hash-verification"
              icon={<Hash className="size-3.5" />}
              title="Hash Verification"
              collapsible
              defaultOpen={!!report}
            >
              {report ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <StatCard
                      label="Verified Nodes"
                      value={String(report.verifiedNodesCount ?? 0)}
                      color="text-primary"
                    />
                    <StatCard
                      label="Tampered Nodes"
                      value={String(report.tamperedNodesCount ?? 0)}
                      color={Number(report.tamperedNodesCount) > 0 ? 'text-destructive' : undefined}
                    />
                    <StatCard
                      label="Missing Nodes"
                      value={String(report.missingNodesCount ?? 0)}
                      color={Number(report.missingNodesCount) > 0 ? 'text-amber-300' : undefined}
                    />
                  </div>
                  <div
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border',
                      report.overallResult === 'VERIFIED'
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-destructive/30 bg-destructive/5',
                    )}
                  >
                    {report.overallResult === 'VERIFIED' ? (
                      <CheckCircle2 className="size-5 text-primary shrink-0" />
                    ) : (
                      <XCircle className="size-5 text-destructive shrink-0" />
                    )}
                    <p className={cn('text-sm font-semibold', report.overallResult === 'VERIFIED' ? 'text-primary' : 'text-destructive')}>
                      {report.overallResult === 'VERIFIED'
                        ? '✔ All hashes verified — workflow is authentic'
                        : `✖ ${report.tamperedNodesCount} tampered node(s) detected`}
                    </p>
                  </div>
                  {Array.isArray(report.tamperedNodes) && report.tamperedNodes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                        Tampered Node IDs
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(report.tamperedNodes as string[]).map((id) => (
                          <code key={id} className="text-[11px] font-mono px-2 py-1 rounded border border-destructive/30 bg-destructive/5 text-destructive">
                            {id.slice(0, 12)}…
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>No verification report available yet.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full gap-1.5"
                    onClick={handleVerifyAgain}
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Run Verification
                  </Button>
                </div>
              )}
            </Section>

            {/* ── SECTION 5: BLOCKCHAIN ─────────────────────────────────── */}
            <Section
              id="blockchain"
              icon={<Blocks className="size-3.5" />}
              title="Blockchain"
              collapsible
              defaultOpen={!!detail.blockchain}
            >
              {detail.blockchain ? (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <StatCard label="Network" value={detail.blockchain.network ?? '—'} />
                    <StatCard label="Block Number" value={String(detail.blockchain.blockNumber ?? '—')} />
                    <StatCard label="Registry ID" value={detail.blockchain.registryId ? detail.blockchain.registryId.slice(0, 10) + '…' : '—'} />
                    <StatCard label="Anchored At" value={detail.blockchain.anchoredAt ? new Date(detail.blockchain.anchoredAt).toLocaleString() : '—'} />
                  </div>
                  <CopyField label="Transaction Hash" value={detail.blockchain.txHash} truncate href={detail.blockchain.explorerUrl ?? undefined} />
                  <CopyField label="Merkle Root (On-chain)" value={detail.blockchain.merkleRoot} truncate />
                  {detail.blockchain.traceHash && (
                    <CopyField label="Trace Hash" value={detail.blockchain.traceHash} truncate />
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {detail.blockchain.publisher && (
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Publisher</p>
                        <code className="text-[11px] font-mono break-all">{detail.blockchain.publisher}</code>
                      </div>
                    )}
                    {detail.blockchain.consumer && (
                      <div>
                        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Consumer</p>
                        <code className="text-[11px] font-mono break-all">{detail.blockchain.consumer}</code>
                      </div>
                    )}
                    {detail.blockchain.probability !== null && (
                      <StatCard label="Probability" value={`${((detail.blockchain.probability ?? 0) / 100).toFixed(0)}%`} />
                    )}
                    {detail.blockchain.confidence !== null && (
                      <StatCard label="Confidence" value={`${((detail.blockchain.confidence ?? 0) / 100).toFixed(0)}%`} />
                    )}
                  </div>
                  {detail.blockchain.explorerUrl && (
                    <a
                      href={detail.blockchain.explorerUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-card/40 text-xs font-mono text-foreground/80 hover:text-accent hover:border-accent/40 transition-colors"
                    >
                      <ExternalLink className="size-3" />
                      View on Explorer
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No blockchain anchor found for this workflow.
                </p>
              )}
            </Section>

            {/* ── SECTION 6: RECEIPT ──────────────────────────────────────── */}
            <Section
              id="receipt"
              icon={<Receipt className="size-3.5" />}
              title="Receipt"
              collapsible
              defaultOpen={!!detail.receipt}
            >
              {detail.receipt ? (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <StatCard label="Amount" value={`${detail.receipt.amount} ${detail.receipt.currency}`} color="text-foreground" />
                    <StatCard label="Status" value={detail.receipt.paymentStatus} />
                    <StatCard label="Paid At" value={detail.receipt.paidAt ? new Date(detail.receipt.paidAt).toLocaleString() : '—'} />
                  </div>
                  {detail.receipt.walletAddress && (
                    <CopyField label="Wallet Address" value={detail.receipt.walletAddress} truncate />
                  )}
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/dashboard/receipts/${detail.receipt.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 bg-card/40 text-xs font-mono text-foreground/80 hover:text-accent hover:border-accent/40 transition-colors"
                    >
                      <ExternalLink className="size-3" />
                      View Full Receipt
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No payment receipt found for this workflow.
                </p>
              )}
            </Section>

            {/* ── SECTION 7: TIMELINE ─────────────────────────────────────── */}
            <Section
              id="timeline"
              icon={<Activity className="size-3.5" />}
              title="Verification Timeline"
            >
              <VerificationTimeline detail={detail} />
            </Section>

            {/* ── SECTION 8: VERIFY AGAIN ─────────────────────────────────── */}
            <Section
              id="verify-again"
              icon={<RefreshCw className="size-3.5" />}
              title="Interactive Verify"
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Run a live cryptographic verification of this workflow. This calls the
                  backend engine to re-check all node hashes and the Merkle root.
                </p>
                <Button
                  onClick={handleVerifyAgain}
                  disabled={verifyMutation.isPending}
                  className="rounded-full gap-2"
                >
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" />
                      Verify Now
                    </>
                  )}
                </Button>

                {verifyResult && (
                  <div
                    className={cn(
                      'p-4 rounded-xl border',
                      verifyResult.success
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-destructive/30 bg-destructive/5',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {verifyResult.success ? (
                        <CheckCircle2 className="size-4 text-primary" />
                      ) : (
                        <XCircle className="size-4 text-destructive" />
                      )}
                      <span className={cn('text-sm font-semibold', verifyResult.success ? 'text-primary' : 'text-destructive')}>
                        {verifyResult.overallResult}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Integrity score: {verifyResult.integrityScore}% ·{' '}
                      {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                )}

                {verifyMutation.isError && (
                  <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-destructive" />
                      <span className="text-sm text-destructive">
                        {verifyMutation.error?.message ?? 'Verification failed'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {/* ── SECTION 9: COMPARE ROOTS ─────────────────────────────────── */}
            <Section
              id="compare-roots"
              icon={<GitBranch className="size-3.5" />}
              title="Compare Roots"
            >
              <RootComparison
                storedRoot={detail.merkle?.rootHash ?? detail.blockchain?.merkleRoot}
                computedRoot={
                  detail.integrityReport !== null && (detail.integrityReport as Record<string, unknown>).isMerkleRootValid === true
                    ? (detail.merkle?.rootHash ?? detail.blockchain?.merkleRoot)
                    : detail.integrityReport !== null && (detail.integrityReport as Record<string, unknown>).isMerkleRootValid === false
                      ? 'ROOT_MISMATCH'
                      : undefined
                }
              />
              <p className="mt-3 text-[11px] text-muted-foreground">
                The computed root is re-derived from all node hashes at verification time.
                If it matches the stored root, the entire Merkle tree is intact.
              </p>
            </Section>
          </>
        )}
      </section>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="px-3 py-2.5 rounded-lg border border-border/40 bg-muted/20">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className={cn('text-sm font-mono font-medium truncate', color ?? 'text-foreground/80')}>
        {value}
      </p>
    </div>
  );
}

function ErrorCard({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="glass-strong rounded-2xl border border-border/60 p-12 text-center">
      <ShieldAlert className="size-10 text-muted-foreground/40 mx-auto mb-4" />
      <h2 className="text-lg font-medium text-foreground mb-2">{message}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        The workflow may not exist or you may not have permission to view it.
      </p>
      <Button variant="outline" size="sm" className="rounded-full" onClick={onBack}>
        <ArrowLeft className="size-3.5 mr-1.5" />
        Back to Verification Center
      </Button>
    </div>
  );
}
