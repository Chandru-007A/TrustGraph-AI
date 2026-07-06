// frontend/lib/workflow/stages.ts
// ─────────────────────────────────────────────────────────────────────────────
// Live workflow progress helpers.
//
// Two responsibilities:
//   1. Map the backend's 11 `nodeName`s to the 11 user-facing display
//      labels in the spec (Planner / Retriever / … / Completed).
//   2. Pure formatters + status derivation used by the progress monitor.
//
// No React, no network — safe to import from server components and tests.
// ─────────────────────────────────────────────────────────────────────────────

import type { NodeStatus, WorkflowNode } from '@/lib/api/workflow.types';

// ── Stage display label map ─────────────────────────────────────────────
// Backend has 11 nodes in `stepIndex` 0–10. The spec lists 11 conceptual
// stages (the 11th is the terminal "Completed" marker for the last row).
// We map them 1:1 in execution order.
export const STAGE_DISPLAY: Record<string, string> = {
  PlannerNode: 'Planner',
  ResearchNode: 'Retriever',
  SourceCollectionNode: 'Retriever Validation',
  ValidationNode: 'Reasoner',
  ReasoningNode: 'Evidence Collection',
  EvidenceAggregatorNode: 'Hash Generation',
  WorkflowRecorderNode: 'Merkle Tree',
  HashQueueNode: 'Receipt Generation',
  MerkleQueueNode: 'Blockchain Commit',
  BlockchainQueueNode: 'Verification',
  PaymentQueueNode: 'Completed',
};

/**
 * Return the user-facing label for a backend `nodeName`. Falls back to
 * the raw name (with "Node" stripped) when the node is unknown — keeps
 * the UI useful even if the engine adds a new stage before this file
 * is updated.
 */
export function getDisplayLabel(nodeName: string): string {
  if (STAGE_DISPLAY[nodeName]) return STAGE_DISPLAY[nodeName];
  return nodeName.endsWith('Node') ? nodeName.slice(0, -4) : nodeName;
}

// ── Stage icon helper (string lookup) ───────────────────────────────────
// Pure additive. The icon map mirrors `components/explainability/explain-timeline.tsx`
// so the visual vocabulary is consistent across the app. Returned as a
// string the caller resolves with a small `Icon` switch — keeps this
// file free of React + lucide imports (safe for server components).
export type StageIconKey =
  | 'plan'
  | 'research'
  | 'validate'
  | 'reason'
  | 'evidence'
  | 'hash'
  | 'blockchain'
  | 'completed'
  | 'generic';

export function getStageIconKey(nodeName: string): StageIconKey {
  const l = nodeName.toLowerCase();
  if (l.includes('plan')) return 'plan';
  if (l.includes('research') || l.includes('retriev')) return 'research';
  if (l.includes('source') || l.includes('validat')) return 'validate';
  if (l.includes('reason') || l.includes('think')) return 'reason';
  if (l.includes('evidence') || l.includes('aggregat')) return 'evidence';
  if (l.includes('hash') || l.includes('merkle') || l.includes('record')) return 'hash';
  if (l.includes('blockchain') || l.includes('receipt')) return 'blockchain';
  if (l.includes('payment') || l.includes('completed')) return 'completed';
  return 'generic';
}

// ── Display status (the 4 states the timeline UI cares about) ──────────
export type DisplayStatus = 'waiting' | 'running' | 'completed' | 'failed';

export function deriveDisplayStatus(
  node: WorkflowNode | undefined,
): DisplayStatus {
  if (!node) return 'waiting';
  switch (node.status) {
    case 'COMPLETED':
      return 'completed';
    case 'RUNNING':
      return 'running';
    case 'FAILED':
      return 'failed';
    case 'QUEUED':
    default:
      return 'waiting';
  }
}

// ── Formatters ──────────────────────────────────────────────────────────

/**
 * Format a duration between two ISO timestamps. If `endIso` is null
 * the current time is used — this is what makes the running stage's
 * duration tick up without a re-render of the timeline.
 */
export function formatDuration(
  startIso: string | null,
  endIso: string | null,
): string | null {
  if (!startIso) return null;
  const startMs = new Date(startIso).getTime();
  const endMs = endIso ? new Date(endIso).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  const ms = Math.max(0, endMs - startMs);
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/** Short wall-clock label (e.g. "14:32:07") — null for unset timestamps. */
export function formatClock(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ── Total workflow duration ────────────────────────────────────────────
// The total wall-clock time the workflow has been running — from the
// earliest `startTime` across all nodes (or `createdAt` if no node has
// started yet) to the latest `endTime` (or "now" if still running).
export function computeTotalDuration(
  nodes: WorkflowNode[],
  fallbackStartIso: string | null,
  isRunning: boolean,
): string | null {
  const started = nodes
    .map((n) => n.startTime)
    .filter((t): t is string => !!t)
    .sort()[0] ?? fallbackStartIso;
  if (!started) return null;

  const lastEnd = nodes
    .map((n) => n.endTime)
    .filter((t): t is string => !!t)
    .sort()
    .pop();
  return formatDuration(started, isRunning || !lastEnd ? null : lastEnd);
}

// ── Failure reason extraction ──────────────────────────────────────────
/** Returns the first node's error message if any node has FAILED. */
export function findFailureReason(nodes: WorkflowNode[]): string | null {
  const failed = nodes.find((n) => n.status === 'FAILED');
  if (!failed) return null;
  if (failed.error && failed.error.trim().length > 0) return failed.error;
  return `Stage "${getDisplayLabel(failed.nodeName)}" (step ${failed.stepIndex + 1}) failed.`;
}

// ── Counters ───────────────────────────────────────────────────────────
export interface StageCounts {
  total: number;
  completed: number;
  running: number;
  failed: number;
  waiting: number;
}

export function countStages(nodes: WorkflowNode[]): StageCounts {
  const out: StageCounts = {
    total: nodes.length,
    completed: 0,
    running: 0,
    failed: 0,
    waiting: 0,
  };
  for (const n of nodes) {
    switch (n.status as NodeStatus) {
      case 'COMPLETED':
        out.completed += 1;
        break;
      case 'RUNNING':
        out.running += 1;
        break;
      case 'FAILED':
        out.failed += 1;
        break;
      case 'QUEUED':
      default:
        out.waiting += 1;
        break;
    }
  }
  return out;
}
