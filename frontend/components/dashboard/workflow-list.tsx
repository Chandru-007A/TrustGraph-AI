// frontend/components/dashboard/workflow-list.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The full workflow history panel: search input, status filter, table
// (skeleton / empty / error / data), and pagination controls.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useDeferredValue, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SESSIONS_LIMIT, useWorkflowSessions } from '@/lib/hooks/use-dashboard';
import type { SessionStatus } from '@/lib/api/workflow.types';
import { cn } from '@/lib/utils';
import { WorkflowRow, WorkflowRowSkeleton } from './workflow-row';

const STATUS_OPTIONS: Array<{ value: 'ALL' | SessionStatus; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'DISPUTED', label: 'Disputed' },
];

const SKELETON_ROWS = 5;

export function WorkflowList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SessionStatus>('ALL');
  const deferredSearch = useDeferredValue(search);

  const {
    rows,
    isPending,
    isError,
    error,
    isFetching,
    refetch,
    totalPages,
    total,
    totalMatching,
  } = useWorkflowSessions({
    page,
    limit: SESSIONS_LIMIT,
    search: deferredSearch,
    statusFilter,
  });

  const filterActive = statusFilter !== 'ALL' || deferredSearch.trim().length > 0;

  return (
    <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
      {/* Toolbar: search + filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 border-b border-border/40">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by workflow ID…"
            className="pl-9 pr-9 h-10 bg-card/40 border-border/60"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as 'ALL' | SessionStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-10 w-full sm:w-44 bg-card/40 border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {isError ? (
        <div className="m-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-start gap-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-medium mb-1">Couldn't load workflows</div>
            <div className="text-destructive/80 text-xs">
              {error instanceof Error ? error.message : 'Unknown error'}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 h-8 text-xs"
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      {/* Table / skeleton / empty */}
      {isPending ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow ID</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Verification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <WorkflowRowSkeleton key={i} />
            ))}
          </TableBody>
        </Table>
      ) : rows.length === 0 ? (
        <div className="p-6">
          {total === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox className="w-5 h-5" />
                </EmptyMedia>
                <EmptyTitle>No workflows yet</EmptyTitle>
                <EmptyDescription>
                  Start a new research session — it'll appear here as soon as the first
                  node is created.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Inbox className="w-5 h-5" />
                </EmptyMedia>
                <EmptyTitle>No workflows match the current filter</EmptyTitle>
                <EmptyDescription>
                  {totalMatching} of {total} sessions match your search.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <WorkflowRow key={s.sessionId} session={s} />
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border/40 text-xs">
              <div className="text-muted-foreground">
                Page {page} of {totalPages} · {total} total
                {filterActive ? ` · ${rows.length} shown` : ''}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 border-t border-border/40 text-xs text-muted-foreground">
              {total} total workflow{total === 1 ? '' : 's'}
              {filterActive ? ` · ${rows.length} shown` : ''}
            </div>
          )}
        </>
      )}

      {/* Subtle fetch indicator (background refetch) */}
      {!isPending && isFetching ? (
        <div
          className={cn(
            'h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent',
            'animate-pulse',
          )}
        />
      ) : null}
    </div>
  );
}
