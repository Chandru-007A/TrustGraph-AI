// frontend/lib/api/types.ts (workflow section appended below)
// ─────────────────────────────────────────────────────────────────────────────
// Workflow + dashboard types.
// ─────────────────────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DISPUTED';

export type PaymentStatus = 'paid' | 'unpaid' | 'refunded';
export type VerificationStatus = 'verified' | 'pending' | 'failed';

export interface WorkflowSession {
  sessionId: string;
  status: SessionStatus;
  /** The workflow blueprint reference (e.g. `workflow_<uuid>`). */
  query: string;
  totalCost: string;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface WorkflowSessionsResponse {
  sessions: WorkflowSession[];
  pagination: Pagination;
}

export type BlockchainStatus = 'connected' | 'mock' | 'disconnected';

export interface WorkflowStats {
  totalWorkflows: number;
  completedWorkflows: number;
  runningWorkflows: number;
  failedWorkflows: number;
  pendingWorkflows: number;
  totalNodes: number;
  purchasedNodes: number;
  verifiedReceipts: number;
  blockchainAnchored: number;
  blockchainStatus: BlockchainStatus;
}

export interface StartWorkflowRequest {
  query: string;
  context?: Record<string, unknown>;
}

/**
 * Response shape from POST /api/v1/workflow/start.
 * Backend returns the full WorkflowResult envelope; we expose the fields
 * the UI needs and keep the rest loosely typed.
 */
export interface StartWorkflowResponse {
  sessionId: string;
  /** True if every stage completed without errors. */
  success: boolean;
  /** Backend-aggregated payment outcome for the workflow. */
  paymentStatus?: string;
  /** Free-form fields from the WorkflowResult (answer, sources, merkle, …). */
  [key: string]: unknown;
}

// ── Per-session detail (live progress monitor) ─────────────────────────
// Returned by GET /workflow/sessions/:sessionId — the Prisma
// `ResearchSession` + its `workflowNodes[]` (ordered by stepIndex asc).
export type NodeStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** Cryptographic anchor persisted alongside a workflow node. */
export interface WorkflowNodeHash {
  id: string;
  nodeId: string;
  /** 'INPUT' | 'OUTPUT' | 'STATE' — what the hash anchors. */
  type: string;
  hashValue: string;
  algorithm: string;
  createdAt: string;
}

export interface WorkflowNode {
  id: string;
  stepIndex: number;
  /** Backend stage name, e.g. 'PlannerNode', 'MerkleQueueNode'. */
  nodeName: string;
  status: NodeStatus;
  startTime: string | null;
  endTime: string | null;
  /** Present only when the backend exposes it (the live route doesn't today). */
  retryCount?: number;
  /** Human-readable error from the node runner when status === 'FAILED'. */
  error?: string;
  /** Decoded agent DID — used as the tooltip / drawer "Agent" field. */
  agentDid?: string;
  /** Edge topology from the live route (the graph-json endpoint encodes the
   *  same information in `edges[].source/target` but the session detail
   *  is the authoritative source for the tooltip / drawer metadata). */
  parentNodeIds?: string[];
  childNodeIds?: string[];
  /** Cryptographic hashes attached to the node (prisma `hashes` relation). */
  hashes?: WorkflowNodeHash[];
}

export interface WorkflowMerkleRoot {
  merkleRootHash: string;
  createdAt?: string;
}

export interface WorkflowSessionDetail {
  id: string;
  workflowId: string;
  status: SessionStatus;
  totalCost: string;
  createdAt: string;
  updatedAt: string;
  workflowNodes: WorkflowNode[];
  merkleRoot: WorkflowMerkleRoot | null;
}

// ── React Flow graph (GET /workflow/:workflowId/graph-json) ──────────────
// Backend serialises through `DAGBuilder.toReactFlow()`: positions are
// pre-computed server-side (BFS depth × 250, sibling index × 150), so the
// client doesn't need to run a layout pass of its own.
export interface GraphJsonNode {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    status: NodeStatus;
    agentDid: string;
    durationMs: number | null;
  };
}

export interface GraphJsonEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphJson {
  nodes: GraphJsonNode[];
  edges: GraphJsonEdge[];
}
