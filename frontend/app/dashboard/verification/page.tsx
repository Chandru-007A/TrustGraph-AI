// frontend/app/dashboard/verification/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — Verification Center: list of all verifiable workflow sessions.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useVerifications } from '@/lib/hooks/use-dashboard';
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
import { VerificationStatusBadge, IntegrityScore } from '@/components/verification/verification-status-badge';

const PAGE_LIMIT = 15;

function short(s: string | null | undefined, n = 10): string {
  if (!s) return '—';
  return s.length > n + 4 ? `${s.slice(0, n)}…${s.slice(-4)}` : s;
}

export default function VerificationListPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?next=/dashboard/verification');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const query = useVerifications({
    page,
    limit: PAGE_LIMIT,
    search: search.trim() || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });

  const items = query.data?.items ?? [];
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
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <Button
          variant="ghost" size="sm" className="rounded-full gap-1.5"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Button>
      </header>

      {/* Body */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-4 pb-24">
        {/* Hero */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground font-mono mb-2">
            Dashboard / Verification
          </p>
          <h1 className="text-3xl lg:text-4xl font-display tracking-tight">
            Verification Center
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Cryptographic proof that every AI reasoning node is authentic.
            Inspect Merkle trees, hash comparisons, and blockchain anchors.
          </p>
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              id="verify-search"
              placeholder="Search workflow ID…"
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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              id="verify-status-filter"
              className="h-9 w-[160px] rounded-full text-sm bg-card/40 border-border/60"
            >
              <SlidersHorizontal className="size-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="VERIFIED">Verified</SelectItem>
              <SelectItem value="TAMPERED">Tampered</SelectItem>
              <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
            </SelectContent>
          </Select>

          <Badge
            variant="outline"
            className="rounded-full border-border/60 bg-card/40 font-mono text-[10px] uppercase tracking-wider ml-auto"
          >
            {query.isLoading ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : (
              <ShieldCheck className="size-3 mr-1" />
            )}
            {query.isLoading
              ? 'Loading'
              : `${pagination?.total ?? items.length} sessions`}
          </Badge>
        </div>

        {/* Table */}
        <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
          {query.isLoading ? (
            <ListSkeleton />
          ) : query.isError ? (
            <div className="px-6 py-10 text-sm text-destructive text-center">
              Could not load verifications.{' '}
              <button
                className="underline"
                onClick={() => query.refetch().catch(() => toast.error('Refresh failed'))}
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <ListEmpty />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Workflow ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Integrity</TableHead>
                    <TableHead>Merkle Root</TableHead>
                    <TableHead>Blockchain</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Receipt ID</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.sessionId}
                      className="cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() =>
                        router.push(`/dashboard/verification/${item.sessionId}`)
                      }
                    >
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        <span title={item.sessionId}>{short(item.sessionId)}</span>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono max-w-[160px]">
                        <span className="block truncate" title={item.workflowId}>
                          {short(item.workflowId, 16)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <VerificationStatusBadge result={item.overallResult} />
                      </TableCell>
                      <TableCell className="text-right">
                        <IntegrityScore score={item.integrityScore} />
                      </TableCell>
                      <TableCell className="text-[11px] font-mono">
                        {item.merkleRoot ? (
                          <span title={item.merkleRoot}>{short(item.merkleRoot)}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.blockchainStatus ? (
                          <Badge
                            variant="outline"
                            className="rounded-full text-[10px] font-mono border-border/60"
                          >
                            {item.blockchainStatus}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.receiptStatus ? (
                          <Badge
                            variant="outline"
                            className="rounded-full text-[10px] font-mono border-border/60"
                          >
                            {item.receiptStatus}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono">
                        {item.receiptId ? (
                          <Link
                            href={`/dashboard/receipts/${item.receiptId}`}
                            className="text-accent hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {short(item.receiptId, 8)}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(item.verifiedAt).toLocaleString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/verification/${item.sessionId}`}
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:underline"
                        >
                          <ExternalLink className="size-2.5" />
                          Inspect
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/60">
              <p className="text-xs font-mono text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" className="rounded-full h-8 px-4 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm" className="rounded-full h-8 px-4 text-xs"
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

function ListSkeleton() {
  return (
    <div className="space-y-2 p-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

function ListEmpty() {
  return (
    <Empty className="border-0 py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldCheck className="size-5" />
        </EmptyMedia>
        <EmptyTitle>No verified workflows yet</EmptyTitle>
        <EmptyDescription>
          Complete a workflow and run verification to see results here.
        </EmptyDescription>
      </EmptyHeader>
      <Button asChild size="sm" className="rounded-full mt-4">
        <Link href="/research">Start New Research</Link>
      </Button>
    </Empty>
  );
}
