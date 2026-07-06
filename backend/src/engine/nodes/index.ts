// src/engine/nodes/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// All 11 Workflow Node classes.
//
// Each class:
//   - Extends BaseWorkflowNode (inherits retry, DB persistence, events, hashing)
//   - Declares its stageName and stepIndex
//   - Injects the appropriate mock agent
//   - Is a pure configuration class — zero business logic here
//
// To add a new stage: create a new class, extend BaseWorkflowNode, inject agent.
// To swap mock → real LLM: inject the new agent class, keep the node unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { BaseWorkflowNode } from '../core/base.node';
import { IAgent, INodePersistence } from '../interfaces';

// ── Stage 1: Planner ──────────────────────────────────────────────────────────
/**
 * PlannerNode: Decomposes the user's raw query into a structured research plan.
 * stepIndex: 0 (first in the pipeline)
 */
export class PlannerNode extends BaseWorkflowNode {
  readonly stageName = 'PlannerNode';
  readonly stepIndex = 0;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 2, baseDelayMs: 300, isFaultTolerant: false });
  }
}

// ── Stage 2: Research ─────────────────────────────────────────────────────────
/**
 * ResearchNode: Executes sub-queries from the Planner and gathers raw findings.
 * stepIndex: 1
 */
export class ResearchNode extends BaseWorkflowNode {
  readonly stageName = 'ResearchNode';
  readonly stepIndex = 1;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 3, baseDelayMs: 500, isFaultTolerant: false });
  }
}

// ── Stage 3: Source Collection ────────────────────────────────────────────────
/**
 * SourceCollectionNode: Finds and scores credible sources for the research.
 * stepIndex: 2
 * isFaultTolerant: true — workflow continues even if sources can't be found
 */
export class SourceCollectionNode extends BaseWorkflowNode {
  readonly stageName = 'SourceCollectionNode';
  readonly stepIndex = 2;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 3, baseDelayMs: 400, isFaultTolerant: true });
  }
}

// ── Stage 4: Validation ───────────────────────────────────────────────────────
/**
 * ValidationNode: Cross-checks findings against sources, rejects unverified claims.
 * stepIndex: 3
 */
export class ValidationNode extends BaseWorkflowNode {
  readonly stageName = 'ValidationNode';
  readonly stepIndex = 3;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 2, baseDelayMs: 300, isFaultTolerant: true });
  }
}

// ── Stage 5: Reasoning ────────────────────────────────────────────────────────
/**
 * ReasoningNode: Applies Chain-of-Thought reasoning to produce conclusions.
 * stepIndex: 4
 */
export class ReasoningNode extends BaseWorkflowNode {
  readonly stageName = 'ReasoningNode';
  readonly stepIndex = 4;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 2, baseDelayMs: 400, isFaultTolerant: false });
  }
}

// ── Stage 6: Evidence Aggregator ──────────────────────────────────────────────
/**
 * EvidenceAggregatorNode: Synthesizes all prior outputs into the final answer.
 * stepIndex: 5
 */
export class EvidenceAggregatorNode extends BaseWorkflowNode {
  readonly stageName = 'EvidenceAggregatorNode';
  readonly stepIndex = 5;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 2, baseDelayMs: 300, isFaultTolerant: false });
  }
}

// ── Stage 7: Workflow Recorder ────────────────────────────────────────────────
/**
 * WorkflowRecorderNode: Creates the immutable audit record of the entire workflow.
 * stepIndex: 6
 */
export class WorkflowRecorderNode extends BaseWorkflowNode {
  readonly stageName = 'WorkflowRecorderNode';
  readonly stepIndex = 6;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 1, baseDelayMs: 200, isFaultTolerant: true });
  }
}

// ── Stage 8: Hash Queue ───────────────────────────────────────────────────────
/**
 * HashQueueNode: Computes SHA-256 of every stage output for Merkle input.
 * stepIndex: 7
 */
export class HashQueueNode extends BaseWorkflowNode {
  readonly stageName = 'HashQueueNode';
  readonly stepIndex = 7;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 1, baseDelayMs: 100, isFaultTolerant: true });
  }
}

// ── Stage 9: Merkle Queue ─────────────────────────────────────────────────────
/**
 * MerkleQueueNode: Builds the Merkle tree and persists the root hash.
 * stepIndex: 8
 */
export class MerkleQueueNode extends BaseWorkflowNode {
  readonly stageName = 'MerkleQueueNode';
  readonly stepIndex = 8;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 1, baseDelayMs: 100, isFaultTolerant: true });
  }
}

// ── Stage 10: Blockchain Queue ────────────────────────────────────────────────
/**
 * BlockchainQueueNode: Anchors the Merkle root to Arc L1.
 * stepIndex: 9
 * isFaultTolerant: true — blockchain congestion shouldn't break the response
 */
export class BlockchainQueueNode extends BaseWorkflowNode {
  readonly stageName = 'BlockchainQueueNode';
  readonly stepIndex = 9;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 3, baseDelayMs: 1000, isFaultTolerant: true });
  }
}

// ── Stage 11: Payment Queue ───────────────────────────────────────────────────
/**
 * PaymentQueueNode: Settles the USDC nanopayment for this research session.
 * stepIndex: 10
 * isFaultTolerant: true — payment can be retried asynchronously
 */
export class PaymentQueueNode extends BaseWorkflowNode {
  readonly stageName = 'PaymentQueueNode';
  readonly stepIndex = 10;
  constructor(agent: IAgent, persistence: INodePersistence) {
    super(agent, persistence, { maxRetries: 3, baseDelayMs: 800, isFaultTolerant: true });
  }
}
