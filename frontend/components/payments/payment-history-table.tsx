// frontend/components/payments/payment-history-table.tsx
'use client';

import { useState } from 'react';
import { usePaymentHistory } from '@/lib/hooks/use-payments';
import type { PaymentHistoryItem } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Loader2, X, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PaymentDetailDrawer } from './payment-detail-drawer';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: 'border-green-500/30 bg-green-500/10 text-green-500',
    PENDING: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
    FAILED: 'border-destructive/30 bg-destructive/10 text-destructive',
    EXPIRED: 'border-destructive/30 bg-destructive/10 text-destructive',
    REFUNDED: 'border-blue-500/30 bg-blue-500/10 text-blue-500',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full font-mono text-[10px]',
        map[status] || 'border-border/60 bg-muted/20 text-muted-foreground'
      )}
    >
      {status}
    </Badge>
  );
}

function short(s: string | null | undefined, n = 8): string {
  if (!s) return '—';
  return s.length > n + 4 ? `${s.slice(0, n)}…${s.slice(-4)}` : s;
}

export function PaymentHistoryTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [selectedPaymentRef, setSelectedPaymentRef] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = usePaymentHistory({
    page,
    limit: 15,
    search: search.trim() || undefined,
    status: status !== 'ALL' ? status : undefined,
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search Reference, Workflow, or Node ID..."
            value={search}
            onChange={handleSearchChange}
            className="pl-8 pr-8 h-9 rounded-full text-sm bg-card/40 border-border/60"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className="h-9 w-[160px] rounded-full text-sm bg-card/40 border-border/60">
            <Filter className="size-3.5 mr-1 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Table */}
      <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm text-destructive">Failed to load payments.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">No payments found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Ref</TableHead>
                  <TableHead>Workflow ID</TableHead>
                  <TableHead>Node Name</TableHead>
                  <TableHead>Price (USDC)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Created Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((item: PaymentHistoryItem) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setSelectedPaymentRef(item.paymentReference)}
                  >
                    <TableCell className="text-[11px] font-mono text-muted-foreground">
                      <span title={item.paymentReference}>{short(item.paymentReference, 8)}</span>
                    </TableCell>
                    <TableCell className="text-[11px] font-mono">
                      <span title={item.workflowId}>{short(item.workflowId, 6)}</span>
                    </TableCell>
                    <TableCell className="text-xs">{item.nodeName}</TableCell>
                    <TableCell className="text-xs font-mono">{item.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      {item.txHash ? (
                        <Badge variant="outline" className="rounded-full text-[10px] font-mono bg-primary/5 text-primary border-primary/30">
                          Gateway
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-[10px] font-mono bg-muted/20 text-muted-foreground border-border/60">
                          Direct
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border/60">
            <p className="text-xs font-mono text-muted-foreground">
              Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} total
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
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <PaymentDetailDrawer
        paymentReference={selectedPaymentRef}
        onOpenChange={(open) => !open && setSelectedPaymentRef(null)}
      />
    </div>
  );
}
