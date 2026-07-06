// src/engine/interfaces/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central interface definitions for the AI Workflow Engine.
//
// DESIGN PRINCIPLE: Dependency Injection via interfaces.
// Every agent, node, and queue accepts its dependencies through these contracts.
// Swapping mock agents for real LLMs = implement the interface, inject the new
// concrete class. Zero changes to the orchestrator or nodes.
// ─────────────────────────────────────────────────────────────────────────────

import { NodeStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Core Domain Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A research request submitted by a user to start a workflow.
 * This is the root input that propagates through all 11 stages.
 */
export interface ResearchRequest {
  sessionId: string;
  userId: string;
  query: string;
  context?: Record<string, unknown>;
  maxRetries?: number;
}

/**
 * The execution context carried between stages.
 * Every node reads from and writes to this context.
 * This is the "shared state" that flows through the pipeline.
 */
export interface WorkflowContext {
  sessionId: string;
  userId: string;
  originalQuery: string;
  // Each stage deposits its output here under its own key
  stageOutputs: Record<string, StageOutput>;
  // Accumulated metadata
  metadata: {
    startedAt: Date;
    totalDurationMs?: number;
    failedStages: string[];
    retryCount: number;
    aiMetrics?: {
      stage: string;
      provider: string;
      latencyMs: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      finishReason: string;
    }[];
  };
}

/**
 * The result produced by a single workflow stage (node).
 * This is what gets persisted to the WorkflowNode table.
 */
export interface StageResult {
  nodeId: string;           // DB WorkflowNode.id
  stageName: string;        // Human-readable stage name
  stepIndex: number;        // Position in the pipeline (0-based)
  agentDid: string;         // The DID of the agent that executed this stage
  status: NodeStatus;
  input: unknown;           // Serialized input
  output: unknown;          // Serialized output
  durationMs: number;
  startTime: Date;
  endTime: Date;
  retryCount: number;
  error?: string;
}

/**
 * The serializable output blob stored in stageOutputs per stage.
 */
export interface StageOutput {
  stageName: string;
  success: boolean;
  data: unknown;
  durationMs: number;
  timestamp: Date;
}

/**
 * The final verified response returned to the client after the full pipeline.
 */
export interface WorkflowResult {
  sessionId: string;
  success: boolean;
  query: string;
  answer: string;
  sources: string[];
  confidence: number;           // 0.0 - 1.0
  evidenceSummary: string;
  hashQueueId?: string;
  merkleRootHash?: string;
  blockchainTxId?: string;
  paymentStatus?: string;
  stages: StageResult[];
  totalDurationMs: number;
  completedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Interface — The Core Abstraction
//
// Every AI agent (mock or real LLM) implements this interface.
// To swap mock → GPT-4: implement IAgent, inject into the node constructor.
// The orchestrator never touches the agent directly — only through this contract.
// ─────────────────────────────────────────────────────────────────────────────

export interface IAgent {
  /** Unique DID identifying this agent on the network */
  readonly agentDid: string;

  /** Human-readable name for logging */
  readonly name: string;

  /**
   * Execute the agent's task.
   * @param input — Whatever the previous stage produced
   * @param context — The full workflow context (read-only for agents)
   * @returns The agent's structured output
   */
  execute(input: unknown, context: Readonly<WorkflowContext>): Promise<unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Interface — Workflow Stage Container
//
// A Node wraps one IAgent. It handles:
//   - persistence to WorkflowNode DB table
//   - retry logic
//   - execution timing
//   - error isolation (failed node ≠ failed workflow)
// ─────────────────────────────────────────────────────────────────────────────

export interface IWorkflowNode {
  readonly stageName: string;
  readonly stepIndex: number;

  /**
   * Run this stage. Returns a StageResult regardless of success/failure.
   * Never throws — errors are captured in StageResult.status = FAILED.
   */
  run(
    input: unknown,
    context: WorkflowContext,
  ): Promise<StageResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue Interface — Queue-Ready Abstraction
//
// Queues are in-process now (synchronous execution order).
// Replace the InMemoryQueue with a Bull/RabbitMQ/SQS adapter later
// without touching any node or orchestrator code.
// ─────────────────────────────────────────────────────────────────────────────

export interface IQueue<T> {
  readonly name: string;
  enqueue(item: T): Promise<void>;
  dequeue(): Promise<T | null>;
  peek(): Promise<T | null>;
  size(): Promise<number>;
  isEmpty(): Promise<boolean>;
  clear(): Promise<void>;
}

/**
 * A queue job — wraps a payload with metadata for retry and tracing.
 */
export interface QueueJob<T> {
  id: string;
  payload: T;
  enqueuedAt: Date;
  attempts: number;
  maxAttempts: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Bus Interface — Decoupled Communication
//
// Nodes emit events. Subscribers (logger, monitoring, webhooks) listen.
// Replace InMemoryEventBus with Redis Pub/Sub or EventBridge later.
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowEventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'stage.started'
  | 'stage.completed'
  | 'stage.failed'
  | 'stage.retrying'
  | 'hash.computed'
  | 'merkle.computed'
  | 'blockchain.queued'
  | 'payment.queued';

export interface WorkflowEvent {
  type: WorkflowEventType;
  sessionId: string;
  stageName?: string;
  stepIndex?: number;
  timestamp: Date;
  data?: unknown;
}

export type EventHandler = (event: WorkflowEvent) => void | Promise<void>;

export interface IEventBus {
  emit(event: WorkflowEvent): void;
  on(eventType: WorkflowEventType, handler: EventHandler): void;
  off(eventType: WorkflowEventType, handler: EventHandler): void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node Persistence Interface
// Abstracts all DB writes for WorkflowNode records.
// ─────────────────────────────────────────────────────────────────────────────

export interface INodePersistence {
  /**
   * Create a QUEUED node record before execution starts.
   * Returns the generated WorkflowNode ID.
   */
  createNode(params: {
    sessionId: string;
    stepIndex: number;
    nodeName: string;
    agentDid: string;
  }): Promise<string>;

  /** Mark a node as RUNNING and record its start time. */
  markRunning(nodeId: string): Promise<void>;

  /** Mark a node as COMPLETED and persist its timing. */
  markCompleted(nodeId: string, endTime: Date): Promise<void>;

  /** Mark a node as FAILED and persist its timing. */
  markFailed(nodeId: string, endTime: Date): Promise<void>;

  /** Store input and output hashes linked to a node. */
  saveHashes(nodeId: string, inputHash: string, outputHash: string): Promise<void>;

  /**
   * Generate and persist the canonical NODE_HASH for a node.
   * Called after the node reaches COMPLETED status, so the verify
   * engine has a stored hash to compare against on subsequent re-verification.
   */
  generateNodeHash(nodeId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Specific Agent Input/Output Contracts
// These typed interfaces document the expected shape of data
// flowing between stages. Real LLMs must conform to these contracts.
// ─────────────────────────────────────────────────────────────────────────────

/** Planner Agent output — the decomposed research plan */
export interface PlannerOutput {
  plan: string;
  subQueries: string[];
  requiredCapabilities: string[];
  estimatedComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** Research Agent output — raw information gathered */
export interface ResearchOutput {
  rawFindings: string[];
  keyFacts: string[];
  uncertainties: string[];
  coverageScore: number; // 0.0 - 1.0
}

/** Source Collection Agent output — verified sources */
export interface SourceCollectionOutput {
  sources: Array<{
    url: string;
    title: string;
    relevanceScore: number;
    credibilityScore: number;
    snippet: string;
  }>;
  totalSourcesFound: number;
}

/** Validation Agent output — fact-checked findings */
export interface ValidationOutput {
  validatedFacts: string[];
  rejectedFacts: string[];
  overallConfidence: number;
  validationNotes: string;
}

/** Reasoning Agent output — logical synthesis */
export interface ReasoningOutput {
  reasoning: string;
  conclusions: string[];
  logicalChain: string[];
  confidence: number;
}

/** Evidence Aggregator output — final compiled answer */
export interface EvidenceAggregatorOutput {
  finalAnswer: string;
  evidenceSummary: string;
  supportingPoints: string[];
  confidence: number;
}

/** Workflow Recorder output — immutable audit record */
export interface WorkflowRecorderOutput {
  recordId: string;
  workflowSummary: string;
  stageCount: number;
  recordedAt: Date;
}

/** Hash Queue output — SHA-256 hashes of all stage outputs */
export interface HashQueueOutput {
  hashes: Array<{ stageName: string; hash: string }>;
  combinedHash: string;
}

/** Merkle Queue output — Merkle tree root of all hashes */
export interface MerkleQueueOutput {
  rootHash: string;
  leaves: string[];
  treeDepth: number;
}

/** Blockchain Queue output — simulated on-chain anchoring */
export interface BlockchainQueueOutput {
  txId: string;
  anchored: boolean;
  blockHeight: number;
  timestamp: Date;
}

/** Payment Queue output — USDC nanopayment settlement */
export interface PaymentQueueOutput {
  paymentId: string;
  amountUsdc: string;
  status: string;
  settledAt: Date;
}
