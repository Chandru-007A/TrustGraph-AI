// frontend/lib/api/workflow.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Workflow + dashboard API. Thin wrapper over the shared axios client so
// 401s trigger the single-flight refresh-and-retry interceptor in client.ts.
// All functions return the unwrapped `data` field of the backend's
// ApiResponse envelope and throw `Error` with a user-friendly message.
// ─────────────────────────────────────────────────────────────────────────────

import apiClient from './client';
import { extractError } from './errors';
import type { ApiResponse } from './types';
import type {
  GraphJson,
  StartWorkflowRequest,
  StartWorkflowResponse,
  WorkflowNode,
  WorkflowSessionDetail,
  WorkflowSessionsResponse,
  WorkflowStats,
} from './workflow.types';

export const workflowService = {
  /** GET /workflow/sessions?page=&limit= */
  async listSessions(params: { page: number; limit: number }): Promise<WorkflowSessionsResponse> {
    try {
      const res = await apiClient.get<ApiResponse<WorkflowSessionsResponse>>(
        '/workflow/sessions',
        { params },
      );
      if (!res.data.data) throw new Error('Invalid server response');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load workflows');
    }
  },

  /** GET /workflow/stats */
  async getStats(): Promise<WorkflowStats> {
    try {
      const res = await apiClient.get<ApiResponse<WorkflowStats>>('/workflow/stats');
      if (!res.data.data) throw new Error('Invalid server response');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load dashboard stats');
    }
  },

  /** POST /workflow/start */
  async startWorkflow(payload: StartWorkflowRequest): Promise<StartWorkflowResponse> {
    try {
      const res = await apiClient.post<ApiResponse<StartWorkflowResponse>>(
        '/workflow/start',
        payload,
      );
      if (!res.data.data) throw new Error('Invalid server response');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to start workflow');
    }
  },

  /**
   * GET /workflow/sessions/:sessionId
   * Returns the live session detail (status + ordered workflowNodes + merkle root).
   * Used by the live progress monitor; polled every 2s.
   */
  async getSessionDetail(sessionId: string): Promise<WorkflowSessionDetail> {
    try {
      const res = await apiClient.get<ApiResponse<WorkflowSessionDetail>>(
        `/workflow/sessions/${sessionId}`,
      );
      if (!res.data.data) throw new Error('Invalid server response');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load workflow session');
    }
  },

  /**
   * GET /workflow/:workflowId/graph-json
   * Returns the React Flow compatible JSON (positions + edges + minimum
   * per-node metadata) for the verified reasoning DAG. The session detail
   * endpoint is the source of truth for tooltip / drawer fields (status
   * times, hashes, parents, children) — graph-json is the layout.
   */
  async getReactFlowGraph(workflowId: string): Promise<GraphJson> {
    try {
      const res = await apiClient.get<ApiResponse<GraphJson>>(
        `/workflow/${workflowId}/graph-json`,
      );
      if (!res.data.data) throw new Error('Invalid server response');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load execution graph');
    }
  },

  /**
   * GET /workflow/session/:sessionId/node/:nodeId
   *
   * x402-protected endpoint. On the first call (no entitlement yet) the
   * backend responds with HTTP 402 and a `PAYMENT-REQUIRED` header
   * containing the challenge envelope. After successful settlement the
   * entitlement is persisted and subsequent calls return 200 with the
   * full WorkflowNode + hashes.
   *
   * The x402 client wrapper in `lib/api/x402.client.ts` handles the
   * 402 → challenge → settle → retry cycle; this service is a thin
   * typed facade so callers don't deal with header encoding.
   */
  async getSessionNodeDetail(
    sessionId: string,
    nodeId: string,
  ): Promise<WorkflowNode> {
    try {
      const res = await apiClient.get<ApiResponse<WorkflowNode>>(
        `/workflow/session/${sessionId}/node/${nodeId}`,
      );
      if (!res.data.data) throw new Error('Invalid server response');
      return res.data.data;
    } catch (err) {
      throw extractError(err, 'Failed to load node detail');
    }
  },
};
