// frontend/components/dashboard/workflow-row.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Single row in the workflow list table. Wraps the entire row in a <Link>
// so clicking anywhere navigates to /dashboard/[sessionId]. The status,
// payment, and verification cells use the Badge component to communicate
// state at a glance.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TableCell,
  TableRow as UITableRow,
} from '@/components/ui/table';
import { humanize, type WorkflowRow as WorkflowRowType } from '@/lib/workflow/status';
import { cn } from '@/lib/utils';

interface WorkflowRowProps {
  session: WorkflowRowType;
}

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
      {humanize(value)}
    </Badge>
  );
}

function PaymentBadge({ value }: { value: string }) {
  const variant =
    value === 'paid'
      ? 'default'
      : value === 'unpaid'
        ? 'outline'
        : 'destructive';
  return (
    <Badge variant={variant} className="font-mono text-[10px] uppercase tracking-wider">
      {humanize(value)}
    </Badge>
  );
}

function VerificationBadge({ value }: { value: string }) {
  const variant =
    value === 'verified'
      ? 'default'
      : value === 'pending'
        ? 'outline'
        : 'destructive';
  return (
    <Badge variant={variant} className="font-mono text-[10px] uppercase tracking-wider">
      {humanize(value)}
    </Badge>
  );
}

export function WorkflowRow({ session }: WorkflowRowProps) {
  return (
    <UITableRow
      className={cn('group cursor-pointer hover:bg-secondary/30')}
      // The whole row is wrapped in a Link below so the click target is
      // the entire tr. Radix and HTML allow this via rowProps on a
      // surrounding <Link> child.
    >
      <TableCell className="py-4">
        <Link
          href={`/dashboard/${session.sessionId}`}
          prefetch={false}
          className="flex items-center gap-3"
        >
          <span className="font-mono text-xs text-foreground/90 truncate max-w-[280px]">
            {session.sessionId}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
      </TableCell>
      <TableCell className="py-4 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(session.createdAt).toLocaleString()}
      </TableCell>
      <TableCell className="py-4">
        <StatusBadge value={session.status} />
      </TableCell>
      <TableCell className="py-4">
        <PaymentBadge value={session.paymentStatus} />
      </TableCell>
      <TableCell className="py-4">
        <VerificationBadge value={session.verificationStatus} />
      </TableCell>
    </UITableRow>
  );
}

export function WorkflowRowSkeleton() {
  return (
    <UITableRow>
      <TableCell className="py-4">
        <Skeleton className="h-4 w-64" />
      </TableCell>
      <TableCell className="py-4">
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell className="py-4">
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell className="py-4">
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell className="py-4">
        <Skeleton className="h-5 w-20" />
      </TableCell>
    </UITableRow>
  );
}
