// frontend/app/dashboard/receipts/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 23 — Receipt Explorer: paginated list of all blockchain receipts.
// Preserves the existing glass / monospace / muted-foreground aesthetic.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Hash,
  Loader2,
  Receipt,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useReceipts } from '@/lib/hooks/use-dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Logo } from '@/components/brand/logo';
import { Spinner } from '@/components/ui/spinner';
import {
  PaymentStatusBadge,
  VerificationStatusBadge,
  OnChainBadge,
} from '@/components/receipts/receipt-status-badge';
import type { ReceiptsListParams } from '@/lib/api/receipt.service';

const PAGE_LIMIT = 15;

function shortStr(s: string | null | undefined, head = 8, tail = 4): string {
  if (!s) return '—';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function ReceiptsListPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?next=/dashboard/receipts');
    }
  }, [authLoading, isAuthenticated, router]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sort]);

  const params: ReceiptsListParams = {
    page,
    limit: PAGE_LIMIT,
    search: search.trim() || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    sort,
  };

  const query = useReceipts(params);
  const receipts = query.data?.receipts ?? [];
  const pagination = query.data?.pagination;

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full gap-1.5"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-4 pb-24">
        {/* Hero */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground font-mono mb-2">
            Dashboard / Receipts
          </p>
          <h1 className="text-3xl lg:text-4xl font-display tracking-tight leading-tight">
            Receipt Explorer
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Every payment and every workflow verification — inspectable like a
            lightweight blockchain explorer.
          </p>
        </div>

        {/* ── Toolbar ───────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              id="receipt-search"
              placeholder="Search ID, workflow, tx hash, node…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-8 h-9 rounded-full text-sm bg-card/40 border-border/60"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              id="receipt-status-filter"
              className="h-9 w-[140px] rounded-full text-sm bg-card/40 border-border/60"
            >
              <SlidersHorizontal className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="UNPAID">Unpaid</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as 'newest' | 'oldest')}
          >
            <SelectTrigger
              id="receipt-sort"
              className="h-9 w-[120px] rounded-full text-sm bg-card/40 border-border/60"
            >
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>

          {/* Count badge */}
          <Badge
            variant="outline"
            className="rounded-full border-border/60 bg-card/40 font-mono text-[10px] uppercase tracking-wider ml-auto"
          >
            {query.isLoading ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <Receipt className="size-3 mr-1" />
            )}
            {query.isLoading
              ? 'Loading'
              : `${pagination?.total ?? receipts.length} receipts`}
          </Badge>
        </div>

        {/* ── Table ─────────────────────────────────────────────── */}
        <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
          {query.isLoading ? (
            <ReceiptsSkeleton />
          ) : query.isError ? (
            <div className="px-6 py-10 text-sm text-destructive text-center">
              Could not load receipts.{' '}
              <button
                className="underline"
                onClick={() => query.refetch().catch(() => toast.error('Refresh failed'))}
              >
                Try again
              </button>
            </div>
          ) : receipts.length === 0 ? (
            <ReceiptsEmpty />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt ID</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Merkle Root</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() =>
                        router.push(`/dashboard/receipts/${r.id}`)
                      }
                    >
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        <span title={r.id}>{shortStr(r.id)}</span>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono max-w-[160px]">
                        <span className="block truncate" title={r.workflowId}>
                          {r.workflowName
                            ? shortStr(r.workflowName, 18, 0).replace(
                                /…$/,
                                '',
                              )
                            : shortStr(r.workflowId)}
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono max-w-[140px]">
                        <span className="block truncate" title={r.nodeId}>
                          {r.nodeName ?? shortStr(r.nodeId)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-[11px] font-mono whitespace-nowrap">
                        {r.amount} {r.currency}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={r.paymentStatus} />
                      </TableCell>
                      <TableCell>
                        <VerificationStatusBadge
                          status={r.verificationStatus}
                        />
                      </TableCell>
                      <TableCell className="text-[11px] font-mono">
                        {r.txHash ? (
                          <span title={r.txHash} className="flex items-center gap-1">
                            <Hash className="size-2.5 text-muted-foreground" />
                            {shortStr(r.txHash)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono">
                        {r.merkleRoot ? (
                          <span title={r.merkleRoot}>
                            {shortStr(r.merkleRoot)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/receipts/${r.id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:underline"
                        >
                          <ExternalLink className="size-2.5" />
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Pagination ──────────────────────────────────────── */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/60">
              <p className="text-xs font-mono text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ·{' '}
                {pagination.total} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-8 px-4 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-8 px-4 text-xs"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ReceiptsSkeleton() {
  return (
    <div className="space-y-2 p-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function ReceiptsEmpty() {
  return (
    <Empty className="border-0 py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Receipt className="size-5" />
        </EmptyMedia>
        <EmptyTitle>No receipts yet</EmptyTitle>
        <EmptyDescription>
          Complete a workflow and unlock reasoning nodes to generate your first
          blockchain receipt.
        </EmptyDescription>
      </EmptyHeader>
      <Button asChild size="sm" className="rounded-full mt-4">
        <Link href="/research">Start New Research</Link>
      </Button>
    </Empty>
  );
}
