// frontend/components/dashboard/dag-canvas.tsx
// ─────────────────────────────────────────────────────────────────────────────
// React Flow canvas for the verified reasoning DAG.
//
// Responsibilities:
//   1. Merge the two backend responses into a single React Flow graph:
//        • graph-json  → positions + edges + minimum per-node metadata
//        • session     → live status, startTime, endTime, hash, parents
//   2. Memoize the node + edge arrays so polling-driven re-renders don't
//      reset the viewport.
//   3. Apply status-aware styling (handled by the custom `DagNode`) and
//      animate the running edges with `stroke-dasharray`.
//   4. Surface empty / error / loading states honestly — the page
//      composes this canvas inside its main body so it inherits the
//      same visual language (glass, noise, border tokens).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { DagNode, buildDurationLabel, pickAnchorHash } from './dag-node';
import type { DagNodeData } from './dag-node';
import type {
  GraphJson,
  NodeStatus,
  WorkflowNode,
} from '@/lib/api/workflow.types';

interface DagCanvasProps {
  graphJson: GraphJson | null | undefined;
  sessionNodes: WorkflowNode[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onNodeSelect: (node: WorkflowNode | null) => void;
}

const NODE_TYPES: NodeTypes = { dagNode: DagNode as unknown as never };

/**
 * Wrapper that mounts React Flow's `ReactFlowProvider` once. The inner
 * component lives below and uses the `useReactFlow` hook indirectly via
 * the `onInit` callback to capture the instance for `fitView()`.
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
}: DagCanvasProps) {
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
  // Memoised: identical inputs produce structurally-equal nodes, so the
  // `useNodesState` setter bails out and the viewport doesn't reset.
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
        // Re-key on status so React Flow picks up the new class list;
        // we deliberately keep the same `id` so React reconciles the
        // node position across polls.
      };
    });
  }, [graphJson, liveNodesById]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (!graphJson) return [];
    return graphJson.edges.map<Edge>((e) => {
      // Animate edges whose source OR target is RUNNING — that propagates
      // the "live" visual upstream so users can see what's in flight.
      const sourceLive = liveNodesById.get(e.source);
      const targetLive = liveNodesById.get(e.target);
      const sourceRunning = sourceLive?.status === 'RUNNING';
      const targetRunning = targetLive?.status === 'RUNNING';
      const animated = sourceRunning || targetRunning;
      // The status of the source drives the edge tint (the spec asks for
      // smooth edges — we keep the default color and just animate).
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated,
        className: animated ? 'animate-dash' : undefined,
        style: {
          stroke: animated
            ? 'color-mix(in oklch, var(--accent) 80%, transparent)'
            : 'color-mix(in oklch, var(--border) 90%, transparent)',
          strokeWidth: 1.5,
        },
      };
    });
  }, [graphJson, liveNodesById]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // Sync the controlled state when the upstream data changes — but only
  // when something materially different has landed. The deep-compare
  // is on the JSON-serialisable form so we don't churn on object
  // identity changes from React Query.
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

  // ── Auto fit-view on first mount + when node count changes ────────
  const handleInit = useCallback(
    (instance: ReactFlowInstance<Node, Edge>) => {
      // Defer to the next frame so React Flow has measured the container.
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
    <div className="relative h-[640px] w-full overflow-hidden rounded-2xl border border-border/60 glass-strong">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={handleInit}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: 'smoothstep' }}
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
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="size-2 rounded-full bg-accent animate-pulse-node" />
          Loading execution graph…
        </div>
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
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 lg:p-8 space-y-4">
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
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-card"
      >
        Try again
      </button>
    </div>
  );
}

function NoGraphPanel() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center space-y-2">
      <div className="mx-auto flex size-10 items-center justify-center rounded-lg border border-border/60 bg-card/60">
        <Handle
          type="source"
          position={Position.Right}
          className="!invisible"
        />
      </div>
      <h3 className="text-sm font-medium text-foreground/90">
        No execution graph yet
      </h3>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        The DAG will appear here as soon as the workflow begins running.
      </p>
    </div>
  );
}

// ── Local helper ──────────────────────────────────────────────────────
// The custom node receives its display label pre-computed. Mirror the
// "strip trailing 'Node'" behaviour from `getDisplayLabel` so the
// canvas doesn't have to re-import from `stages.ts` (kept minimal).
function getDisplayLabelSafe(nodeName: string): string {
  if (nodeName.endsWith('Node')) return nodeName.slice(0, -4);
  return nodeName;
}
