// frontend/app/dashboard/[sessionId]/dag/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Interactive DAG visualisation for a verified research workflow —
// cinematic edition.
//
// Data flow:
//   1. useWorkflowProgress(sessionId)     — 2s polling; stops on terminal status.
//   2. workflowService.getReactFlowGraph(sessionId) — positions + edges.
//
// The session detail is the source of truth for tooltip / drawer
// fields (status, startTime, endTime, hash, parents, children); the
// graph-json endpoint provides layout only. The two are merged in
// <DagCanvas> via a Map lookup by node id.
//
// Visual additions (cinematic):
//   • Header H1 reveals with the existing `animate-char-in` keyframe
//     (per-character, staggered)
//   • Subtitle fades in with motion.div
//   • Summary tiles reveal on viewport entry via motion.div + whileInView
//   • Two ambient orbs (`animate-orb-a/b`) drift behind the canvas
//   • The canvas is wrapped in a layered ambient background
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { useAuth } from '@/hooks/use-auth';
import { apiClient } from '@/lib/api';
import type { ApiResponse } from '@/lib/api/types';
import { useWorkflowProgress } from '@/lib/hooks/use-workflow-progress';
import type {
  GraphJson,
  WorkflowNode,
} from '@/lib/api/workflow.types';
import { DagCanvas } from '@/components/dashboard/dag-canvas';
import { DagDrawer } from '@/components/dashboard/dag-drawer';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

const PAGE_TITLE = 'DAG viewer';

export default function DagPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (params.sessionId as string) ?? '';
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // ── Auth bootstrap guard ────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?next=/dashboard/${sessionId}/dag`);
    }
  }, [authLoading, isAuthenticated, router, sessionId]);

  // ── Live session detail (polled) ────────────────────────────────────
  const sessionQuery = useWorkflowProgress(sessionId);
  const session = sessionQuery.data;
  // The /workflow/:id/graph-json route validates :id as a UUID against
  // ResearchSession.id, so we must pass the session's UUID — not its
  // blueprint `workflowId` (which is an IPFS hash). See workflow.service
  // `getReactFlowDag` for the matching lookup.
  const sessionIdFromSession = session?.id;

  // ── Graph layout (positions + edges) ────────────────────────────────
  // Pulled once and refreshed on demand. We don't poll this separately
  // because the node positions are static — the live data is the
  // status, times, and hash, which all live in the session detail.
  const graphQuery = useQuery({
    queryKey: ['workflow', 'dag', sessionIdFromSession, 'graph-json'],
    queryFn: async (): Promise<GraphJson> => {
      const res = await apiClient.get<ApiResponse<GraphJson>>(
        `/workflow/${sessionIdFromSession}/graph-json`,
      );
      if (!res.data.data) {
        throw new Error('Invalid server response');
      }
      return res.data.data;
    },
    enabled: !!sessionIdFromSession,
    staleTime: 30_000,
  });

  // ── Drawer state ────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNodeSelect = (node: WorkflowNode | null) => {
    setSelectedNode(node);
    setDrawerOpen(node !== null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      {/* Layered ambient background — radial gradient + drifting orbs */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute inset-0 animate-aurora"
          style={{
            background:
              'radial-gradient(ellipse at 25% 0%, oklch(0.7 0.13 232 / 0.10), transparent 55%), radial-gradient(ellipse at 80% 100%, oklch(0.78 0.15 168 / 0.08), transparent 55%)',
          }}
        />
        <div
          className="absolute -top-32 -left-24 size-[28rem] rounded-full blur-3xl opacity-50 animate-orb-a"
          style={{
            background:
              'radial-gradient(circle, oklch(0.7 0.13 232 / 0.30), transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-40 -right-20 size-[32rem] rounded-full blur-3xl opacity-40 animate-orb-b"
          style={{
            background:
              'radial-gradient(circle, oklch(0.78 0.15 168 / 0.28), transparent 70%)',
          }}
        />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 grid-bg opacity-40" />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-10">
        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="mb-10 flex items-center justify-between gap-4"
        >
          <Link
            href={`/dashboard/${sessionId}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back to workflow
          </Link>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/dashboard">All sessions</Link>
          </Button>
        </motion.div>

        <header className="mb-8">
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm text-muted-foreground font-mono mb-3"
          >
            Execution graph
          </motion.p>
          <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-2 flex flex-wrap">
            {PAGE_TITLE.split('').map((ch, i) => (
              <span
                key={`${ch}-${i}`}
                className="animate-char-in text-gradient inline-block"
                style={{ animationDelay: `${i * 32}ms` }}
              >
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="text-sm text-muted-foreground max-w-2xl"
          >
            Interactive visualisation of the verified reasoning DAG. Drag
            nodes, scroll to zoom, click a stage to inspect.
          </motion.p>
        </header>

        {sessionQuery.isPending ? (
          <PageSkeleton />
        ) : sessionQuery.isError ? (
          <PageError
            message={
              (sessionQuery.error as { message?: string } | undefined)
                ?.message ?? 'Failed to load session'
            }
            onRetry={() => void sessionQuery.refetch()}
          />
        ) : session ? (
          <div className="space-y-6">
            <SummaryGrid
              workflowId={sessionIdFromSession ?? ''}
              sessionId={session.id}
              merkleRootHash={session.merkleRoot?.merkleRootHash ?? null}
              nodeCount={session.workflowNodes.length}
            />

            <DagCanvas
              graphJson={graphQuery.data ?? null}
              sessionNodes={session.workflowNodes}
              isLoading={graphQuery.isPending && !graphQuery.data}
              isError={graphQuery.isError}
              errorMessage={
                (graphQuery.error as { message?: string } | undefined)
                  ?.message ?? null
              }
              onRetry={() => void graphQuery.refetch()}
              onNodeSelect={handleNodeSelect}
              isDrawerOpen={drawerOpen}
            />
          </div>
        ) : null}
      </div>

      <DagDrawer
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o);
          if (!o) setSelectedNode(null);
        }}
        node={selectedNode}
        allNodes={session?.workflowNodes ?? []}
        sessionId={sessionId}
      />
    </main>
  );
}

function SummaryGrid({
  workflowId,
  sessionId,
  merkleRootHash,
  nodeCount,
}: {
  workflowId: string;
  sessionId: string;
  merkleRootHash: string | null;
  nodeCount: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryTile
        label="Workflow ID"
        icon={<WorkflowIcon className="w-3.5 h-3.5" />}
        value={workflowId}
      />
      <SummaryTile label="Session ID" value={sessionId} />
      <SummaryTile
        label="Merkle root"
        icon={<ShieldCheck className="w-3.5 h-3.5" />}
        value={merkleRootHash ?? 'Not anchored yet'}
        truncate
      />
      <SummaryTile label="Nodes in DAG" value={String(nodeCount)} />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  truncate = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  truncate?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 flex flex-col gap-1.5 min-w-0"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
      </div>
      <div
        className={
          'text-xs font-mono text-foreground/90 ' + (truncate ? 'truncate' : '')
        }
        title={value}
      >
        {value}
      </div>
    </motion.div>
  );
}

function PageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
      aria-hidden
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl border border-border/60 bg-card/40 animate-pulse"
          />
        ))}
      </div>
      <div className="h-[640px] rounded-2xl border border-border/60 glass-strong animate-pulse" />
    </motion.div>
  );
}

function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 lg:p-8 space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg border border-destructive/40 bg-destructive/10 flex items-center justify-center shrink-0">
          <Loader2 className="w-4 h-4 text-destructive" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-destructive">
            Could not load session
          </h3>
          <p className="text-xs text-destructive/80 mt-1 leading-relaxed break-words">
            {message}
          </p>
        </div>
      </div>
      <motion.div
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="inline-block"
      >
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onRetry}
        >
          Try again
        </Button>
      </motion.div>
    </motion.div>
  );
}
