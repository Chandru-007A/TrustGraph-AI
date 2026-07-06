// frontend/components/dashboard/dag-canvas.tsx
// ─────────────────────────────────────────────────────────────────────────────
// React Flow canvas for the verified reasoning DAG — cinematic edition.
//
// Responsibilities:
//   1. Merge the two backend responses into a single React Flow graph:
//        • graph-json  → positions + edges + minimum per-node metadata
//        • session     → live status, startTime, endTime, hash, parents
//   2. Memoize the node + edge arrays so polling-driven re-renders don't
//      reset the viewport.
//   3. Status-aware styling (handled by the custom `DagNode`) plus
//      status-aware edge styling (gradient + dash flow + travelling
//      particles for running edges).
//   4. Layered ambient background — radial vignette + drifting orbs behind
//      the React Flow surface.
//   5. Live counters Panel (top-left) and custom "Fit view" / "Reset zoom"
//      controls (top-right) so the user has a sense of the workflow's
//      state at a glance.
//   6. Camera pull-back: when the drawer opens, the canvas scales to 0.95
//      and blurs slightly, so the modal reads as a stage-projection.
//
// What did NOT change:
//   • The public prop shape (graphJson, sessionNodes, isLoading, isError,
//     errorMessage, onRetry, onNodeSelect). `isDrawerOpen` is a new
//     optional prop with a default of `false`.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  getBezierPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  AlertCircle,
  Maximize2,
  type LucideIcon,
} from 'lucide-react';

import { DagNode, buildDurationLabel, pickAnchorHash } from './dag-node';
import type { DagNodeData } from './dag-node';
import type {
  GraphJson,
  NodeStatus,
  WorkflowNode,
} from '@/lib/api/workflow.types';
import { countStages } from '@/lib/workflow/stages';
import { cn } from '@/lib/utils';

interface DagCanvasProps {
  graphJson: GraphJson | null | undefined;
  sessionNodes: WorkflowNode[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onNodeSelect: (node: WorkflowNode | null) => void;
  /** When true, the canvas dims + scales + blurs to make room for the
   *  stage-projection modal. */
  isDrawerOpen?: boolean;
}

const NODE_TYPES: NodeTypes = { dagNode: DagNode as unknown as never };

// ── Custom edge: status-aware stroke + travelling particles ────────────
type EdgeStatus = 'waiting' | 'running' | 'completed' | 'failed';

const EDGE_STROKE: Record<EdgeStatus, string> = {
  running: 'oklch(0.7 0.13 232 / 0.85)',
  completed: 'oklch(0.78 0.15 168 / 0.7)',
  failed: 'oklch(0.62 0.2 20 / 0.75)',
  waiting: 'oklch(0.28 0.014 264 / 0.6)',
};

const EDGE_FILTER: Record<EdgeStatus, string> = {
  running: 'drop-shadow(0 0 6px oklch(0.7 0.13 232 / 0.55))',
  completed: 'drop-shadow(0 0 5px oklch(0.78 0.15 168 / 0.40))',
  failed: 'drop-shadow(0 0 5px oklch(0.62 0.2 20 / 0.40))',
  waiting: 'none',
};

interface ParticleEdgeData {
  status: EdgeStatus;
}

function ParticleEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
  } = props;
  const status = (data as ParticleEdgeData | undefined)?.status ?? 'waiting';
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: EDGE_STROKE[status],
          strokeWidth: status === 'running' ? 1.75 : 1.4,
          strokeDasharray:
            status === 'running'
              ? '6 6'
              : status === 'failed'
                ? '4 4'
                : undefined,
          filter: EDGE_FILTER[status],
        }}
        className={status === 'running' ? 'animate-dash' : undefined}
      />
      {status === 'running' ? (
        <>
          <circle r="3.5" fill="oklch(0.78 0.15 168)">
            <animateMotion
              dur="1.8s"
              repeatCount="indefinite"
              path={edgePath}
            />
          </circle>
          <circle r="2.5" fill="oklch(0.7 0.13 232)">
            <animateMotion
              dur="1.8s"
              begin="0.6s"
              repeatCount="indefinite"
              path={edgePath}
            />
          </circle>
        </>
      ) : null}
    </>
  );
}

const EDGE_TYPES = { particle: ParticleEdge };

/**
 * Wrapper that mounts React Flow's `ReactFlowProvider` once.
 */
export function DagCanvas(props: DagCanvasProps) {
  return (
    <ReactFlowProvider>
      <DagCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function DagCanvasInner({
  graphJson,
  sessionNodes,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onNodeSelect,
  isDrawerOpen = false,
}: DagCanvasProps) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // ── Live counters (used by the top-left Panel) ──────────────────────
  const counts = useMemo(() => countStages(sessionNodes), [sessionNodes]);

  // ── Build a fast lookup of live nodes by id ────────────────────────
  const liveNodesById = useMemo(() => {
    const m = new Map<string, WorkflowNode>();
    for (const n of sessionNodes) m.set(n.id, n);
    return m;
  }, [sessionNodes]);

  // ── Pre-emptively compute a "no DAG" signal ────────────────────────
  const noGraph =
    !isLoading && !isError && (graphJson?.nodes.length ?? 0) === 0;

  // ── Convert graph-json + session detail → React Flow shapes ────────
  const initialNodes = useMemo<Node[]>(() => {
    if (!graphJson) return [];
    return graphJson.nodes.map<Node>((n) => {
      const live = liveNodesById.get(n.id);
      const status: NodeStatus = live?.status ?? n.data.status;
      const isRunning = status === 'RUNNING';
      const workflowNode: WorkflowNode = live ?? {
        id: n.id,
        stepIndex: 0,
        nodeName: n.data.label,
        status,
        startTime: null,
        endTime: null,
        agentDid: n.data.agentDid,
      };
      const data: DagNodeData = {
        displayLabel: getDisplayLabelSafe(n.data.label),
        nodeName: n.data.label,
        status,
        hash: pickAnchorHash(live),
        durationLabel: buildDurationLabel(
          live?.startTime ?? null,
          live?.endTime ?? null,
        ),
        isRunning,
        workflowNode,
      };
      return {
        id: n.id,
        type: 'dagNode',
        position: n.position,
        data: data as unknown as Record<string, unknown>,
        draggable: true,
        selectable: true,
      };
    });
  }, [graphJson, liveNodesById]);

  // Per-edge status: source wins, then target, then 'waiting'.
  const edgeStatusOf = useCallback(
    (e: { source: string; target: string }): EdgeStatus => {
      const src = liveNodesById.get(e.source);
      const tgt = liveNodesById.get(e.target);
      const srcStatus = src?.status ?? 'QUEUED';
      const tgtStatus = tgt?.status ?? 'QUEUED';
      if (srcStatus === 'RUNNING' || tgtStatus === 'RUNNING') return 'running';
      if (srcStatus === 'FAILED' || tgtStatus === 'FAILED') return 'failed';
      if (srcStatus === 'COMPLETED' && tgtStatus === 'COMPLETED')
        return 'completed';
      return 'waiting';
    },
    [liveNodesById],
  );

  const initialEdges = useMemo<Edge[]>(() => {
    if (!graphJson) return [];
    return graphJson.edges.map<Edge>((e) => {
      const status = edgeStatusOf(e);
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'particle',
        data: { status },
      };
    });
  }, [graphJson, edgeStatusOf]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // ── Click handler: forward the underlying workflow node upward ─────
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const data = node.data as unknown as DagNodeData | undefined;
      onNodeSelect(data?.workflowNode ?? null);
    },
    [onNodeSelect],
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  // ── Auto fit-view on first mount ──────────────────────────────────
  const handleInit = useCallback(
    (instance: ReactFlowInstance<Node, Edge>) => {
      requestAnimationFrame(() => {
        instance.fitView({ padding: 0.2, includeHiddenNodes: false });
      });
    },
    [],
  );

  // ── Status-coloured minimap ───────────────────────────────────────
  const nodeColor = useCallback((n: Node) => {
    const data = n.data as unknown as DagNodeData | undefined;
    switch (data?.status) {
      case 'COMPLETED':
        return 'color-mix(in oklch, var(--success) 80%, transparent)';
      case 'RUNNING':
        return 'color-mix(in oklch, var(--accent) 80%, transparent)';
      case 'FAILED':
        return 'color-mix(in oklch, var(--destructive) 80%, transparent)';
      default:
        return 'color-mix(in oklch, var(--muted) 60%, transparent)';
    }
  }, []);

  // ── Render branches ───────────────────────────────────────────────
  if (isLoading) {
    return <CanvasSkeleton />;
  }
  if (isError) {
    return (
      <ErrorPanel
        message={errorMessage ?? 'Failed to load execution graph'}
        onRetry={onRetry}
      />
    );
  }
  if (noGraph) {
    return <NoGraphPanel />;
  }

  return (
    <motion.div
      // Camera pull-back when the drawer opens
      animate={{
        scale: isDrawerOpen ? 0.95 : 1,
        filter: isDrawerOpen ? 'blur(2px)' : 'blur(0px)',
        opacity: isDrawerOpen ? 0.6 : 1,
      }}
      transition={{ type: 'spring', stiffness: 240, damping: 28 }}
      className="relative h-[640px] w-full overflow-hidden rounded-2xl border border-border/60 glass-strong"
    >
      {/* Ambient layer — drifting orbs behind the canvas */}
      <AmbientBackground />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={handleInit}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: 'particle' }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="color-mix(in oklch, var(--foreground) 10%, transparent)"
        />

        {/* Live counters — top-left */}
        <Panel position="top-left" className="!m-3">
          <CountersCard counts={counts} />
        </Panel>

        {/* Custom toolbar — top-right */}
        <Panel position="top-right" className="!m-3">
          <CanvasToolbar
            onFit={() => void fitView({ padding: 0.2, duration: 480 })}
            onZoomIn={() => void zoomIn({ duration: 240 })}
            onZoomOut={() => void zoomOut({ duration: 240 })}
          />
        </Panel>

        <Controls
          showInteractive={false}
          className="!border !border-border/60 !bg-card/80 !text-foreground/80"
        />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeColor="color-mix(in oklch, var(--border) 80%, transparent)"
          nodeBorderRadius={6}
          pannable
          zoomable
          maskColor="color-mix(in oklch, var(--background) 60%, transparent)"
          className="!border !border-border/60 !bg-card/80"
        />
      </ReactFlow>
    </motion.div>
  );
}

// ── Live counters card (top-left Panel) ────────────────────────────────
const STATUS_GLYPH: Record<keyof ReturnType<typeof countStages>, LucideIcon> = {
  total: CircleDashed,
  completed: CheckCircle2,
  running: Loader2,
  failed: AlertCircle,
  waiting: CircleDashed,
};

const STATUS_LABEL: Record<keyof ReturnType<typeof countStages>, string> = {
  total: 'Total',
  completed: 'Completed',
  running: 'Running',
  failed: 'Failed',
  waiting: 'Waiting',
};

const STATUS_TINT: Record<keyof ReturnType<typeof countStages>, string> = {
  total: 'text-foreground/80',
  completed: 'text-emerald-400',
  running: 'text-accent',
  failed: 'text-destructive',
  waiting: 'text-muted-foreground',
};

function CountersCard({
  counts,
}: {
  counts: ReturnType<typeof countStages>;
}) {
  const keys: (keyof ReturnType<typeof countStages>)[] = [
    'total',
    'completed',
    'running',
    'waiting',
    'failed',
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="glass-strong rounded-xl border border-border/60 px-3 py-2.5"
    >
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
        <span className="size-1.5 rounded-full bg-primary animate-pulse-node" />
        Live execution
      </div>
      <div className="grid grid-cols-5 gap-2.5">
        {keys.map((k) => {
          const Icon = STATUS_GLYPH[k];
          return (
            <div
              key={k}
              className="flex flex-col items-center gap-0.5 min-w-[44px]"
            >
              <div className="flex items-center gap-1">
                <Icon
                  className={cn(
                    'size-3',
                    STATUS_TINT[k],
                    k === 'running' && 'animate-spin',
                  )}
                />
                <span
                  className={cn(
                    'text-sm font-mono font-medium tabular-nums',
                    STATUS_TINT[k],
                  )}
                >
                  {counts[k]}
                </span>
              </div>
              <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/80">
                {STATUS_LABEL[k]}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Custom toolbar (top-right Panel) ───────────────────────────────────
function CanvasToolbar({
  onFit,
  onZoomIn,
  onZoomOut,
}: {
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.05 }}
      className="flex items-center gap-1 rounded-xl border border-border/60 bg-card/80 p-1 backdrop-blur"
    >
      <ToolbarButton onClick={onZoomOut} label="Zoom out">
        <span className="text-base leading-none">−</span>
      </ToolbarButton>
      <ToolbarButton onClick={onZoomIn} label="Zoom in">
        <span className="text-base leading-none">+</span>
      </ToolbarButton>
      <span className="mx-1 h-4 w-px bg-border/60" />
      <ToolbarButton onClick={onFit} label="Fit view">
        <Maximize2 className="size-3.5" />
      </ToolbarButton>
    </motion.div>
  );
}

function ToolbarButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      className="flex size-7 items-center justify-center rounded-md text-foreground/80 hover:bg-accent/10 hover:text-foreground transition-colors"
      aria-label={label}
      title={label}
    >
      {children}
    </motion.button>
  );
}

// ── Ambient background (orbs + vignette) ───────────────────────────────
function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at top, oklch(0.7 0.13 232 / 0.10), transparent 60%), radial-gradient(ellipse at bottom right, oklch(0.78 0.15 168 / 0.08), transparent 60%)',
        }}
      />
      {/* Drifting orbs */}
      <div
        className="absolute -top-20 -left-20 size-80 rounded-full blur-3xl opacity-40 animate-orb-a"
        style={{
          background:
            'radial-gradient(circle, oklch(0.7 0.13 232 / 0.35), transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-24 -right-16 size-96 rounded-full blur-3xl opacity-30 animate-orb-b"
        style={{
          background:
            'radial-gradient(circle, oklch(0.78 0.15 168 / 0.30), transparent 70%)',
        }}
      />
    </div>
  );
}

// ── Sub-views ─────────────────────────────────────────────────────────

function CanvasSkeleton() {
  return (
    <div
      className="relative h-[640px] w-full overflow-hidden rounded-2xl border border-border/60 glass-strong"
      aria-busy
    >
      <div className="absolute inset-0 grid-bg opacity-40" />
      <AmbientBackground />
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 text-xs font-mono text-muted-foreground"
        >
          <span className="size-2 rounded-full bg-accent animate-pulse-node" />
          Loading execution graph…
        </motion.div>
      </div>
    </div>
  );
}

function ErrorPanel({
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
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10">
          <span className="font-mono text-sm text-destructive">!</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-destructive">
            Failed to load execution graph
          </h3>
          <p className="mt-1 text-xs text-destructive/80 leading-relaxed break-words">
            {message}
          </p>
        </div>
      </div>
      <motion.button
        type="button"
        onClick={onRetry}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-card"
      >
        Try again
      </motion.button>
    </motion.div>
  );
}

function NoGraphPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-10 text-center space-y-2"
    >
      <AmbientBackground />
      <div className="relative">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg border border-border/60 bg-card/60">
          <CircleDashed className="size-5 text-muted-foreground animate-pulse-node" />
        </div>
        <h3 className="text-sm font-medium text-foreground/90">
          No execution graph yet
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          The DAG will appear here as soon as the workflow begins running.
        </p>
      </div>
    </motion.div>
  );
}

// ── Local helper ──────────────────────────────────────────────────────
function getDisplayLabelSafe(nodeName: string): string {
  if (nodeName.endsWith('Node')) return nodeName.slice(0, -4);
  return nodeName;
}
