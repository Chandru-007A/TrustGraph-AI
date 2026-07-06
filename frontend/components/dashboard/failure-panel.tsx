// frontend/components/dashboard/failure-panel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Failure panel. Shown when the session status is FAILED.
//
// Displays:
//   • The failure reason returned by the backend (per-node error message,
//     or a fallback that names the failing stage).
//   • A retry action.
//
// The retry action is intentionally a "Start a new workflow" link rather
// than a true session-retry: the backend has no `POST /workflow/:id/retry`
// endpoint, and the original query is not persisted server-side, so we
// route the user to /research where they can re-enter the query. This is
// the spec's "if supported" path — we surface the affordance honestly.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { AlertOctagon, ArrowRight } from 'lucide-react';
import { findFailureReason } from '@/lib/workflow/stages';
import type { WorkflowNode } from '@/lib/api/workflow.types';
import { Button } from '@/components/ui/button';

interface FailurePanelProps {
  nodes: WorkflowNode[];
}

export function FailurePanel({ nodes }: FailurePanelProps) {
  const reason = findFailureReason(nodes);

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg border border-destructive/40 bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertOctagon className="w-4 h-4 text-destructive" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-destructive">
            Workflow halted
          </h3>
          <p className="text-xs text-destructive/80 mt-1 leading-relaxed">
            One or more stages failed. TrustGraph records the failure
            reason so the run can be diagnosed before you retry.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-destructive/20 bg-background/40 p-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-destructive/70 mb-1.5">
          Failure reason
        </div>
        <div className="text-sm text-foreground/90 leading-relaxed break-words">
          {reason ?? 'No failure reason was returned by the backend.'}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button asChild variant="default" size="sm" className="rounded-full">
          <Link href="/research">
            Start a new workflow
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
