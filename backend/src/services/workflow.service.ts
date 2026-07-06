// src/services/workflow.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// WorkflowService — Business Logic Layer
//
// Sits between the HTTP controller and the WorkflowExecutionManager.
// Responsible for:
//   1. Creating the ResearchSession record in the DB
//   2. Validating the request
//   3. Delegating execution to the WorkflowExecutionManager
//   4. Querying session history
//
// Never contains orchestration logic — that lives in the engine.
// ─────────────────────────────────────────────────────────────────────────────

import { SessionStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import httpStatus from 'http-status';
import prisma from '../utils/prisma';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { workflowExecutionManager } from '../engine/core/execution.manager';
import { WorkflowResult } from '../engine/interfaces';
import { DAGBuilder } from '../engine/dag/dag.builder';

export interface StartWorkflowParams {
  userId: string;
  query: string;
  context?: Record<string, unknown>;
}

export interface WorkflowSessionSummary {
  sessionId: string;
  status: SessionStatus;
  query: string;
  totalCost: string;
  nodeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class WorkflowService {
  /**
   * Start a new research workflow.
   *
   * Steps:
   *   1. Validate query is non-empty
   *   2. Create ResearchSession record (PENDING)
   *   3. Dispatch to WorkflowExecutionManager (async)
   *   4. Return WorkflowResult
   */
  async startWorkflow(params: StartWorkflowParams): Promise<WorkflowResult> {
    const { userId, query } = params;

    if (!query || query.trim().length < 3) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Query must be at least 3 characters long');
    }

    if (query.trim().length > 1000) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Query must not exceed 1000 characters');
    }

    // Generate a workflow ID (would be an IPFS hash of the blueprint in production)
    const workflowId = `workflow_${uuidv4()}`;

    // Create the ResearchSession record in PENDING status
    const session = await prisma.researchSession.create({
      data: {
        userId,
        workflowId,
        status: SessionStatus.PENDING,
        totalCost: 0,
      },
    });

    logger.info(
      `[WorkflowService] Created session ${session.id} for user ${userId} — query: "${query}"`,
    );

    // Execute the full 11-stage pipeline
    const result = await workflowExecutionManager.execute({
      sessionId: session.id,
      userId,
      query: query.trim(),
      context: params.context,
    });

    return result;
  }

  /**
   * Get a paginated list of research sessions for a user.
   */
  async getUserSessions(
    userId: string,
    page = 1,
    limit = 10,
  ): Promise<{ sessions: WorkflowSessionSummary[]; total: number }> {
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.researchSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { workflowNodes: true } },
        },
      }),
      prisma.researchSession.count({ where: { userId } }),
    ]);

    return {
      sessions: sessions.map((s) => ({
        sessionId: s.id,
        status: s.status,
        query: s.workflowId, // workflowId stores the query blueprint reference
        totalCost: s.totalCost.toString(),
        nodeCount: s._count.workflowNodes,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      total,
    };
  }

  /**
   * Get the full detail of a specific session, including all workflow nodes.
   */
  async getSessionDetail(sessionId: string, userId: string) {
    const session = await prisma.researchSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        workflowNodes: {
          include: { hashes: true },
          orderBy: { stepIndex: 'asc' },
        },
        merkleRoot: true,
      },
    });

    if (!session) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');
    }

    return session;
  }

  /**
   * Build the DAG for a specific session by updating node relationships.
   */
  async buildDag(sessionId: string, userId: string) {
    const session = await prisma.researchSession.findFirst({
      where: { id: sessionId, userId },
      include: { workflowNodes: { orderBy: { stepIndex: 'asc' } } },
    });

    if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');

    const nodes = session.workflowNodes;
    if (nodes.length === 0) return { success: true, message: 'No nodes found' };

    // Update DB to link nodes sequentially based on stepIndex
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const parents = i > 0 ? [nodes[i - 1].id] : [];
      const children = i < nodes.length - 1 ? [nodes[i + 1].id] : [];

      await prisma.workflowNode.update({
        where: { id: node.id },
        data: {
          nodeName: node.nodeName === 'UnknownNode' ? `Stage-${node.stepIndex}` : node.nodeName,
          parentNodeIds: parents,
          childNodeIds: children,
        },
      });
    }

    return { success: true, message: 'DAG built successfully' };
  }

  /**
   * Retrieve the DAG in standard JSON format.
   */
  async getDag(sessionId: string, userId: string) {
    const session = await prisma.researchSession.findFirst({
      where: { id: sessionId, userId },
      include: { workflowNodes: true },
    });

    if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');

    const builder = new DAGBuilder(sessionId);
    builder.loadFromDatabase(session.workflowNodes);
    return builder.toJSON();
  }

  /**
   * Retrieve the DAG in React Flow format.
   */
  async getReactFlowDag(sessionId: string, userId: string) {
    const session = await prisma.researchSession.findFirst({
      where: { id: sessionId, userId },
      include: { workflowNodes: true },
    });

    if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');

    const builder = new DAGBuilder(sessionId);
    builder.loadFromDatabase(session.workflowNodes);
    return builder.toReactFlow();
  }

  /**
   * Retrieve node details by ID, validating user ownership of the session.
   */
  async getNodeDetail(nodeId: string, userId: string) {
    const node = await prisma.workflowNode.findFirst({
      where: {
        id: nodeId,
        session: { userId },
      },
      include: { hashes: true },
    });

    if (!node) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Workflow node not found');
    }

    return node;
  }

  /**
   * Retrieve node details for a specific session, validating user ownership.
   */
  async getSessionNodeDetail(sessionId: string, nodeId: string, userId: string) {
    const node = await prisma.workflowNode.findFirst({
      where: {
        id: nodeId,
        sessionId,
        session: { userId },
      },
      include: { hashes: true },
    });

    if (!node) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Workflow node not found in this session');
    }

    return node;
  }

  /**
   * Retrieve details for the reasoning node of a workflow execution.
   */
  async getReasoningNodeDetail(nodeId: string, userId: string) {
    const node = await prisma.workflowNode.findFirst({
      where: {
        id: nodeId,
        nodeName: 'ReasoningNode',
        session: { userId },
      },
      include: { hashes: true },
    });

    if (!node) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Reasoning node not found');
    }

    return node;
  }
}

// Singleton
export const workflowService = new WorkflowService();

