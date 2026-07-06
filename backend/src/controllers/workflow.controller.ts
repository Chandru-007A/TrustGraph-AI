// src/controllers/workflow.controller.ts
// ─────────────────────────────────────────────────────────────────────────────
// WorkflowController — HTTP layer for the AI Workflow Engine.
//
// Endpoints:
//   POST /api/v1/workflow/start     — Start a research workflow
//   GET  /api/v1/workflow/sessions  — List user's sessions (paginated)
//   GET  /api/v1/workflow/sessions/:sessionId — Get session detail
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import ApiResponse from '../utils/ApiResponse';
import { workflowService } from '../services/workflow.service';

/**
 * POST /api/v1/workflow/start
 *
 * Initiates the full 11-stage AI research workflow.
 * This is a synchronous endpoint in the current phase —
 * the response is returned only after all stages complete.
 *
 * In a future async phase: return a sessionId immediately,
 * use WebSockets or polling for progress.
 */
export const startWorkflow = catchAsync(async (req: Request, res: Response) => {
  const result = await workflowService.startWorkflow({
    userId: req.user!.id,
    query: req.body.query,
    context: req.body.context,
  });

  const statusCode = result.success ? httpStatus.OK : httpStatus.UNPROCESSABLE_ENTITY;

  res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      result.success ? 'Workflow completed successfully' : 'Workflow completed with errors',
      {
        sessionId: result.sessionId,
        success: result.success,
        answer: result.answer,
        sources: result.sources,
        confidence: result.confidence,
        evidenceSummary: result.evidenceSummary,
        merkleRootHash: result.merkleRootHash,
        blockchainTxId: result.blockchainTxId,
        paymentStatus: result.paymentStatus,
        totalDurationMs: result.totalDurationMs,
        completedAt: result.completedAt,
        stages: result.stages.map((s) => ({
          stageName: s.stageName,
          stepIndex: s.stepIndex,
          status: s.status,
          durationMs: s.durationMs,
          retryCount: s.retryCount,
          error: s.error,
        })),
      },
    ),
  );
});

/**
 * GET /api/v1/workflow/sessions
 * Returns paginated list of user's research sessions.
 */
export const getMySessions = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const { sessions, total } = await workflowService.getUserSessions(
    req.user!.id,
    page,
    limit,
  );

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Sessions retrieved', {
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }),
  );
});

/**
 * GET /api/v1/workflow/sessions/:sessionId
 * Returns full detail of a specific session including all workflow nodes.
 */
export const getSessionDetail = catchAsync(async (req: Request, res: Response) => {
  const session = await workflowService.getSessionDetail(
    req.params.sessionId,
    req.user!.id,
  );

  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Session detail retrieved', session),
  );
});

/**
 * POST /api/v1/workflow/:id/build-dag
 * Builds the Directed Acyclic Graph (DAG) for a workflow execution.
 */
export const buildDag = catchAsync(async (req: Request, res: Response) => {
  const result = await workflowService.buildDag(req.params.id, req.user!.id);
  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result.message, result),
  );
});

/**
 * GET /api/v1/workflow/:id/dag
 * Retrieves standard JSON representation of the workflow DAG.
 */
export const getDag = catchAsync(async (req: Request, res: Response) => {
  const dag = await workflowService.getDag(req.params.id, req.user!.id);
  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'DAG retrieved successfully', dag),
  );
});

/**
 * GET /api/v1/workflow/:id/graph-json
 * Retrieves React Flow compatible JSON for graph visualization.
 */
export const getReactFlowDag = catchAsync(async (req: Request, res: Response) => {
  const reactFlowData = await workflowService.getReactFlowDag(req.params.id, req.user!.id);
  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'React Flow DAG retrieved successfully', reactFlowData),
  );
});

/**
 * GET /api/v1/workflow/node/:nodeId
 * Retrieve workflow node details (protected by x402Middleware).
 */
export const getNodeDetail = catchAsync(async (req: Request, res: Response) => {
  const result = await workflowService.getNodeDetail(req.params.nodeId, req.user!.id);
  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Node detail retrieved', result),
  );
});

/**
 * GET /api/v1/workflow/session/:sessionId/node/:nodeId
 * Retrieve node details for a specific session (protected by x402Middleware).
 */
export const getSessionNodeDetail = catchAsync(async (req: Request, res: Response) => {
  const { sessionId, nodeId } = req.params;
  const result = await workflowService.getSessionNodeDetail(sessionId, nodeId, req.user!.id);
  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Session node detail retrieved', result),
  );
});

/**
 * GET /api/v1/workflow/reasoning/:nodeId
 * Retrieve reasoning node details (protected by x402Middleware).
 */
export const getReasoningNode = catchAsync(async (req: Request, res: Response) => {
  const result = await workflowService.getReasoningNodeDetail(req.params.nodeId, req.user!.id);
  res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, 'Reasoning node detail retrieved', result),
  );
});

