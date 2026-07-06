// frontend/components/dashboard/dag-drawer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Right-side detail drawer for a single DAG node.
//
// Opens when a user clicks a node on the canvas; closes via the X button,
// the overlay click, or the Escape key (Radix default).
//
// Contents (per the page spec):
//   • Header        — stage display label + status badge
//   • Stage         — display label + raw backend name + step index
//   • Agent         — agent DID (or "—")
//   • Prompt        — x402 unlock experience (idle / challenge /
//                     settling / success / failed / expired / network)
//   • Output Preview — same x402 unlock experience, scoped to the
//                     output-side hashes
//   • Execution Duration — formatted wall-clock
//   • Hash          — full anchor hash, truncated copyable
//   • Started / Finished — wall-clock timestamps
//   • Status        — full enum + human label
//   • Parent Nodes  — list of parent stage labels (by name resolution)
//   • Child Nodes   — list of child stage labels
//
// The drawer no longer fakes a "Locked" placeholder — the unlock
// experience is a real, end-to-end interaction with the backend's
// x402 middleware.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useMemo } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  CircleDashed,
  Clock,
  ExternalLink,
  Hash as HashIcon,
  Loader2,
  ShieldCheck,
  Timer,
  Workflow as WorkflowIcon,
  XCircle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import {
  deriveDisplayStatus,
  formatClock,
  formatDuration,
  getDisplayLabel,
  type DisplayStatus,
} from '@/lib/workflow/stages';
import type { WorkflowNode } from '@/lib/api/workflow.types';
import type { X402SettlementResult } from '@/lib/api/types';
import { DagDrawerUnlock } from './dag-drawer-unlock';

interface DagDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The selected node from the live session detail. */
  node: WorkflowNode | null;
  /** Index of `node` in the session's workflowNodes — used to resolve parents
   *  / children by name. The graph-json `parentNodeIds` / `childNodeIds` are
   *  also present on the node but the index is a stable fallback. */
  allNodes: WorkflowNode[];
  /** Session that owns `node` — used by the unlock flow. */
  sessionId: string;
}

const STATUS_META: Record<
  DisplayStatus,
  { icon: typeof CheckCircle2; color: string; label: string; badge: string }
> = {
  waiting: {
    icon: CircleDashed,
    color: 'text-muted-foreground',
    label: 'Waiting',
    badge: 'border-border/60 text-muted-foreground bg-card/60',
  },
  running: {
    icon: Loader2,
    color: 'text-accent',
    label: 'Running',
    badge: 'border-accent/40 text-accent bg-accent/10',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    label: 'Completed',
    badge: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  },
  failed: {
    icon: AlertOctagon,
    color: 'text-destructive',
    label: 'Failed',
    badge: 'border-destructive/40 text-destructive bg-destructive/10',
  },
};

export function DagDrawer({
  open,
  onOpenChange,
  node,
  allNodes,
  sessionId,
}: DagDrawerProps) {
  const { user } = useAuth();
  // Resolve parents/children by id (preferred) with a positional fallback
  // so the list is useful even when the backend omits parent/child ids.
  const related = useMemo(() => {
    if (!node) return { parents: [], children: [] };
    const byId = new Map(allNodes.map((n) => [n.id, n]));
    const parents = (node.parentNodeIds ?? [])
      .map((id) => byId.get(id))
      .filter((n): n is WorkflowNode => !!n);
    const children = (node.childNodeIds ?? [])
      .map((id) => byId.get(id))
      .filter((n): n is WorkflowNode => !!n);
    if (parents.length === 0 && node.stepIndex > 0) {
      const prev = allNodes.find((n) => n.stepIndex === node.stepIndex - 1);
      if (prev) parents.push(prev);
    }
    if (children.length === 0 && node.stepIndex < allNodes.length - 1) {
      const next = allNodes.find((n) => n.stepIndex === node.stepIndex + 1);
      if (next) children.push(next);
    }
    return { parents, children };
  }, [node, allNodes]);

  const status = node ? deriveDisplayStatus(node) : 'waiting';
  const meta = STATUS_META[status];
  const StatusIcon = meta.icon;
  const hash = node?.hashes?.[0]?.hashValue ?? null;
  const displayLabel = node ? getDisplayLabel(node.nodeName) : '';
  const duration =
    node && (node.startTime || node.endTime)
      ? formatDuration(node.startTime, node.endTime)
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="glass-strong w-full sm:max-w-md p-0 overflow-y-auto"
      >
        {node ? (
          <div className="flex h-full flex-col">
            {/* ── Header ────────────────────────────────────────── */}
            <SheetHeader className="border-b border-border/60 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg border',
                    meta.badge,
                  )}
                >
                  <StatusIcon
                    className={cn(
                      'size-4',
                      meta.color,
                      status === 'running' && 'animate-spin',
                    )}
                  />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-display tracking-tight">
                    {displayLabel}
                  </SheetTitle>
                  <SheetDescription className="text-xs font-mono">
                    {node.nodeName} · step {String(node.stepIndex + 1).padStart(2, '0')}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider',
                    meta.badge,
                  )}
                >
                  {meta.label}
                </span>
                {node.status === 'FAILED' && node.error ? (
                  <span className="rounded-full border border-destructive/40 bg-destructive/5 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-destructive">
                    {node.error}
                  </span>
                ) : null}
              </div>
            </SheetHeader>

            {/* ── Body ──────────────────────────────────────────── */}
            <div className="flex-1 space-y-5 p-6">
              <Section icon={<WorkflowIcon className="size-3.5" />} label="Stage">
                <div className="text-sm text-foreground/90">{displayLabel}</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {node.nodeName}
                </div>
              </Section>

              <Section
                icon={<ShieldCheck className="size-3.5" />}
                label="Agent"
              >
                <div
                  className="truncate text-sm font-mono text-foreground/90"
                  title={node.agentDid ?? '—'}
                >
                  {node.agentDid ?? '—'}
                </div>
              </Section>

              <Section
                icon={<WorkflowIcon className="size-3.5" />}
                label="Prompt"
              >
                {user ? (
                  <DagDrawerUnlock
                    user={user}
                    sessionId={sessionId}
                    node={node}
                    variant="prompt"
                  >
                    {({ node: unlocked, settlement }) => (
                      <UnlockedPrompt
                        node={unlocked}
                        settlement={settlement}
                      />
                    )}
                  </DagDrawerUnlock>
                ) : null}
              </Section>

              <Section
                icon={<ExternalLink className="size-3.5" />}
                label="Output Preview"
              >
                {user ? (
                  <DagDrawerUnlock
                    user={user}
                    sessionId={sessionId}
                    node={node}
                    variant="output"
                  >
                    {({ node: unlocked, settlement }) => (
                      <UnlockedOutput
                        node={unlocked}
                        settlement={settlement}
                      />
                    )}
                  </DagDrawerUnlock>
                ) : null}
              </Section>

              <Section icon={<Timer className="size-3.5" />} label="Execution Duration">
                <div className="text-sm font-mono text-foreground/90">
                  {duration ?? '—'}
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {node.startTime && node.endTime
                    ? `${formatClock(node.startTime)} → ${formatClock(node.endTime)}`
                    : 'Awaiting timestamps'}
                </div>
              </Section>

              <Section icon={<HashIcon className="size-3.5" />} label="Hash">
                {hash ? (
                  <HashValue value={hash} />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Not anchored yet
                  </div>
                )}
              </Section>

              <div className="grid grid-cols-2 gap-3">
                <Section icon={<Clock className="size-3.5" />} label="Started">
                  <div className="text-sm font-mono text-foreground/90">
                    {formatClock(node.startTime) ?? '—'}
                  </div>
                </Section>
                <Section icon={<Clock className="size-3.5" />} label="Finished">
                  <div className="text-sm font-mono text-foreground/90">
                    {formatClock(node.endTime) ?? '—'}
                  </div>
                </Section>
              </div>

              <Section
                icon={<XCircle className="size-3.5" />}
                label="Status"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider',
                      meta.badge,
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {node.status}
                  </span>
                </div>
              </Section>

              {related.parents.length > 0 ? (
                <RelatedList
                  icon={<WorkflowIcon className="size-3.5" />}
                  label="Parent Nodes"
                  nodes={related.parents}
                />
              ) : null}
              {related.children.length > 0 ? (
                <RelatedList
                  icon={<WorkflowIcon className="size-3.5" />}
                  label="Child Nodes"
                  nodes={related.children}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Select a node to inspect its details.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Small local helpers ────────────────────────────────────────────────

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <div className="rounded-lg border border-border/50 bg-card/40 px-3 py-2">
        {children}
      </div>
    </div>
  );
}

function UnlockedPrompt({
  node,
  settlement,
}: {
  node: WorkflowNode;
  settlement: X402SettlementResult | null;
}) {
  const input = useMemo(
    () => (node.hashes ?? []).find((h) => h.type === 'INPUT'),
    [node.hashes],
  );
  const stateHashes = useMemo(
    () => (node.hashes ?? []).filter((h) => h.type === 'STATE'),
    [node.hashes],
  );

  return (
    <div className="space-y-2.5">
      <PromptSubsection label="Prompt">
        {input ? (
          <HashRow hash={input} />
        ) : (
          <Empty value="No input hash recorded" />
        )}
      </PromptSubsection>
      <PromptSubsection label="Execution">
        {stateHashes[0] ? (
          <HashRow hash={stateHashes[0]} />
        ) : (
          <Empty value="No execution trace recorded" />
        )}
      </PromptSubsection>
      {stateHashes[1] ? (
        <PromptSubsection label="Reasoning">
          <HashRow hash={stateHashes[1]} />
        </PromptSubsection>
      ) : null}
      {stateHashes[2] ? (
        <PromptSubsection label="Evidence">
          <HashRow hash={stateHashes[2]} />
        </PromptSubsection>
      ) : null}
      <PurchaseReceipt settlement={settlement} />
    </div>
  );
}

function UnlockedOutput({
  node,
  settlement,
}: {
  node: WorkflowNode;
  settlement: X402SettlementResult | null;
}) {
  const output = useMemo(
    () => (node.hashes ?? []).find((h) => h.type === 'OUTPUT'),
    [node.hashes],
  );
  const stateHashes = useMemo(
    () => (node.hashes ?? []).filter((h) => h.type === 'STATE'),
    [node.hashes],
  );

  return (
    <div className="space-y-2.5">
      <PromptSubsection label="Output">
        {output ? <HashRow hash={output} /> : <Empty value="No output hash recorded" />}
      </PromptSubsection>
      {stateHashes[0] ? (
        <PromptSubsection label="Execution">
          <HashRow hash={stateHashes[0]} />
        </PromptSubsection>
      ) : null}
      {stateHashes[1] ? (
        <PromptSubsection label="Reasoning">
          <HashRow hash={stateHashes[1]} />
        </PromptSubsection>
      ) : null}
      {stateHashes[2] ? (
        <PromptSubsection label="Evidence">
          <HashRow hash={stateHashes[2]} />
        </PromptSubsection>
      ) : null}
      <PurchaseReceipt settlement={settlement} />
    </div>
  );
}

function PromptSubsection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300/80">
        <CheckCircle2 className="size-2.5" />
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function HashRow({ hash }: { hash: NonNullable<WorkflowNode['hashes']>[number] }) {
  return (
    <div className="space-y-1.5">
      <div
        className="break-all text-[11px] font-mono text-foreground/90"
        title={hash.hashValue}
      >
        {hash.hashValue}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
        <span>{hash.algorithm}</span>
        <span aria-hidden>·</span>
        <span>{new Date(hash.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

function Empty({ value }: { value: string }) {
  return <div className="text-[11px] text-muted-foreground/80">{value}</div>;
}

function PurchaseReceipt({
  settlement,
}: {
  settlement: X402SettlementResult | null;
}) {
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 space-y-1.5 animate-unlock-glow">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-300">
        <CheckCircle2 className="size-3" />
        Verified Purchase
      </div>
      <dl className="grid grid-cols-1 gap-1 text-[11px]">
        <ReceiptRow
          label="Receipt ID"
          value={settlement?.transactionHash ?? '—'}
        />
        <ReceiptRow
          label="Payment Reference"
          value={settlement?.payerAddress ?? '—'}
        />
        <ReceiptRow
          label="Unlocked Time"
          value={
            settlement?.paymentStatus === 'PAID'
              ? new Date().toLocaleTimeString()
              : '—'
          }
        />
      </dl>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
        {label}
      </dt>
      <dd
        className="truncate text-right font-mono text-foreground/80"
        title={value}
      >
        {value === '—'
          ? '—'
          : value.length > 18
            ? `${value.slice(0, 10)}…${value.slice(-6)}`
            : value}
      </dd>
    </div>
  );
}

function HashValue({ value }: { value: string }) {
  return (
    <div className="space-y-1.5">
      <div
        className="break-all text-[11px] font-mono text-foreground/90"
        title={value}
      >
        {value}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 rounded-full px-2 text-[10px]"
        onClick={() => {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(value);
          }
        }}
      >
        Copy
      </Button>
    </div>
  );
}

function RelatedList({
  icon,
  label,
  nodes,
}: {
  icon: React.ReactNode;
  label: string;
  nodes: WorkflowNode[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {nodes.map((n) => (
          <span
            key={n.id}
            className="rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5 text-[10px] font-mono text-foreground/80"
            title={n.nodeName}
          >
            {getDisplayLabel(n.nodeName)}
          </span>
        ))}
      </div>
    </div>
  );
}
