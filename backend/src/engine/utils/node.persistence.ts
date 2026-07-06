// src/engine/utils/node.persistence.ts
// ─────────────────────────────────────────────────────────────────────────────
// Concrete implementation of INodePersistence.
//
// Responsible for all WorkflowNode DB operations:
//   - Creates QUEUED records before execution
//   - Updates status to RUNNING → COMPLETED/FAILED
//   - Persists input/output hashes in the Hash table
//
// Uses the existing Prisma singleton — no new DB connections created.
// ─────────────────────────────────────────────────────────────────────────────

import { NodeStatus } from '@prisma/client';
import prisma from '../../utils/prisma';
import logger from '../../utils/logger';
import { INodePersistence } from '../interfaces';
import { hashService } from '../hash/hash.service';

export class NodePersistenceService implements INodePersistence {
  /**
   * Create a WorkflowNode record in QUEUED status.
   * Called at the start of each stage before the agent runs.
   * Returns the generated UUID for subsequent status updates.
   */
  async createNode(params: {
    sessionId: string;
    stepIndex: number;
    nodeName: string;
    agentDid: string;
  }): Promise<string> {
    const node = await prisma.workflowNode.create({
      data: {
        sessionId: params.sessionId,
        stepIndex: params.stepIndex,
        nodeName: params.nodeName,
        agentDid: params.agentDid,
        status: NodeStatus.QUEUED,
      },
    });

    logger.debug(
      `[NodePersistence] Created QUEUED node ${node.id} (step ${params.stepIndex}, name ${params.nodeName})`,
    );
    return node.id;
  }

  /**
   * Transition a node from QUEUED → RUNNING.
   * Records the actual start time (not the creation time).
   */
  async markRunning(nodeId: string): Promise<void> {
    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        status: NodeStatus.RUNNING,
        startTime: new Date(),
      },
    });

    logger.debug(`[NodePersistence] Node ${nodeId} → RUNNING`);
  }

  /**
   * Transition a node from RUNNING → COMPLETED.
   * Records the end time for duration calculation.
   */
  async markCompleted(nodeId: string, endTime: Date): Promise<void> {
    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        status: NodeStatus.COMPLETED,
        endTime,
      },
    });

    logger.debug(`[NodePersistence] Node ${nodeId} → COMPLETED`);
  }

  /**
   * Transition a node from RUNNING → FAILED.
   * Records the end time. The workflow continues despite the failure.
   */
  async markFailed(nodeId: string, endTime: Date): Promise<void> {
    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        status: NodeStatus.FAILED,
        endTime,
      },
    });

    logger.warn(`[NodePersistence] Node ${nodeId} → FAILED`);
  }

  /**
   * Persist SHA-256 hashes of the node's input and output.
   * Stores only hashes — raw data never enters the DB (privacy-preserving).
   * These hashes become leaves in the Merkle tree.
   */
  async saveHashes(nodeId: string, inputHash: string, outputHash: string): Promise<void> {
    await prisma.hash.createMany({
      data: [
        { nodeId, type: 'INPUT', hashValue: inputHash },
        { nodeId, type: 'OUTPUT', hashValue: outputHash },
      ],
    });

    logger.debug(`[NodePersistence] Saved input/output hashes for node ${nodeId}`);
  }

  /**
   * Generate the canonical NODE_HASH for a node by reading its current DB
   * state (including the just-saved INPUT/OUTPUT hashes) and storing the
   * SHA-256 of the canonical node shape. The verify engine later recomputes
   * this same hash and compares — any drift indicates tampering.
   */
  async generateNodeHash(nodeId: string): Promise<void> {
    try {
      await hashService.generateHashFromNodeId(nodeId);
    } catch (err: any) {
      logger.warn(`[NodePersistence] generateNodeHash failed for ${nodeId}: ${err.message}`);
    }
  }
}
