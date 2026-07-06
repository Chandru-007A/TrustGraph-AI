// src/routes/v1/workflow.route.ts
// All workflow API routes. Protected by auth middleware.

import express from 'express';
import * as workflowController from '../../controllers/workflow.controller';
import * as workflowStatsController from '../../controllers/workflow-stats.controller';
import validate from '../../middlewares/validate.middleware';
import * as workflowValidation from '../../validations/workflow.validation';
import * as workflowStatsValidation from '../../validations/workflow-stats.validation';
import { auth } from '../../middlewares/auth.middleware';
import { x402Middleware } from '../../middlewares/x402.middleware';

const router = express.Router();

// All workflow routes require authentication
router.use(auth);

/**
 * GET /api/v1/workflow/node/:nodeId
 * Retrieve workflow node details. Protected by x402 payment middleware.
 */
router.get(
  '/node/:nodeId',
  validate(workflowValidation.getNodeDetailSchema),
  x402Middleware,
  workflowController.getNodeDetail,
);

/**
 * GET /api/v1/workflow/session/:sessionId/node/:nodeId
 * Retrieve session-specific workflow node details. Protected by x402 payment middleware.
 */
router.get(
  '/session/:sessionId/node/:nodeId',
  validate(workflowValidation.getSessionNodeDetailSchema),
  x402Middleware,
  workflowController.getSessionNodeDetail,
);

/**
 * GET /api/v1/workflow/reasoning/:nodeId
 * Retrieve reasoning node details. Protected by x402 payment middleware.
 */
router.get(
  '/reasoning/:nodeId',
  validate(workflowValidation.getNodeDetailSchema),
  x402Middleware,
  workflowController.getReasoningNode,
);


/**
 * POST /api/v1/workflow/start
 * Start a new AI research workflow.
 * Roles: any authenticated user
 */
router.post(
  '/start',
  validate(workflowValidation.startWorkflowSchema),
  workflowController.startWorkflow,
);

/**
 * GET /api/v1/workflow/sessions
 * List user's research sessions with pagination.
 */
router.get(
  '/sessions',
  validate(workflowValidation.getSessionsSchema),
  workflowController.getMySessions,
);

/**
 * GET /api/v1/workflow/stats
 * Aggregated dashboard stats: totals by status, node count, purchased nodes,
 * verified receipts, anchored receipts, blockchain mode.
 *
 * Must be mounted BEFORE the `/:id/*` patterns so Express doesn't try to
 * match "stats" as an `:id` and reject it as a non-UUID.
 */
router.get(
  '/stats',
  auth,
  validate(workflowStatsValidation.getStatsSchema),
  workflowStatsController.getStats,
);

/**
 * GET /api/v1/workflow/sessions/:sessionId
 * Get full detail of a specific session.
 */
router.get(
  '/sessions/:sessionId',
  validate(workflowValidation.getSessionDetailSchema),
  workflowController.getSessionDetail,
);

/**
 * POST /api/v1/workflow/:id/build-dag
 * Builds the DAG for a workflow execution.
 */
router.post(
  '/:id/build-dag',
  validate(workflowValidation.getDagSchema),
  workflowController.buildDag,
);

/**
 * GET /api/v1/workflow/:id/dag
 * Get standard JSON representation of the workflow DAG.
 */
router.get(
  '/:id/dag',
  validate(workflowValidation.getDagSchema),
  workflowController.getDag,
);

/**
 * GET /api/v1/workflow/:id/graph-json
 * Get React Flow compatible JSON for graph visualization.
 */
router.get(
  '/:id/graph-json',
  validate(workflowValidation.getDagSchema),
  workflowController.getReactFlowDag,
);

export default router;
