// src/engine/verify/verify.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// VerificationService — Verifies workflow integrity and logs verification events.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../../utils/prisma';
import logger from '../../utils/logger';
import { hashService } from '../hash/hash.service';
import { merkleTreeService } from '../merkle/merkle.service';
import { VerificationType } from '@prisma/client';
import { MerkleProofStep } from '../merkle/interfaces';
import {
  NodeVerificationResult,
  ProofVerificationResult,
  WorkflowIntegrityReport,
} from './interfaces';

export class VerificationService {
  /**
   * Log a verification event to the database.
   */
  private async logEvent(
    sessionId: string,
    verificationType: VerificationType,
    isValid: boolean,
    result: any,
    durationMs: number,
    verifierId?: string,
  ) {
    try {
      await prisma.verificationLog.create({
        data: {
          sessionId,
          verificationType,
          isValid,
          result: result as any,
          durationMs,
          verifierId,
        },
      });
    } catch (err: any) {
      logger.error(`[VerificationService] Failed to log event: ${err.message}`);
    }
  }

  /**
   * Verify a single node's hash integrity.
   */
  async verifyNodeHash(nodeId: string, verifierId?: string): Promise<NodeVerificationResult> {
    const start = Date.now();

    const dbNode = await prisma.workflowNode.findUnique({
      where: { id: nodeId },
      include: { hashes: { where: { type: { startsWith: 'NODE_HASH' } } } },
    });

    if (!dbNode) {
      return {
        nodeId,
        expectedHash: '',
        computedHash: '',
        isValid: false,
        status: 'MISSING',
        verifiedAt: new Date(),
        discrepancy: 'Node not found',
      };
    }

    const expectedHashRecord = dbNode.hashes[0];
    if (!expectedHashRecord) {
      return {
        nodeId,
        expectedHash: '',
        computedHash: '',
        isValid: false,
        status: 'MISSING',
        verifiedAt: new Date(),
        discrepancy: 'Node hash not found in Hash Engine',
      };
    }

    const expectedHash = expectedHashRecord.hashValue;
    const verifyResult = await hashService.verifyHash({ nodeId, expectedHash });

    const status = verifyResult.isValid ? 'VERIFIED' : 'TAMPERED';
    const durationMs = Date.now() - start;

    const result: NodeVerificationResult = {
      nodeId,
      expectedHash,
      computedHash: verifyResult.computedHash,
      isValid: verifyResult.isValid,
      status,
      discrepancy: verifyResult.discrepancy,
      verifiedAt: verifyResult.verifiedAt,
    };

    await this.logEvent(
      dbNode.sessionId,
      VerificationType.NODE_HASH,
      verifyResult.isValid,
      result,
      durationMs,
      verifierId,
    );

    return result;
  }

  /**
   * Verify a Merkle proof statelessly.
   * Finds the sessionId from the merkle tree to log the event, if possible.
   */
  async verifyMerkleProof(
    leafHash: string,
    proof: MerkleProofStep[],
    rootHash: string,
    verifierId?: string,
  ): Promise<ProofVerificationResult> {
    const start = Date.now();
    const result = merkleTreeService.verifyProof(leafHash, proof, rootHash);
    const durationMs = Date.now() - start;

    const merkleRoot = await prisma.merkleRoot.findUnique({
      where: { rootHash },
    });

    if (merkleRoot) {
      await this.logEvent(
        merkleRoot.sessionId,
        VerificationType.MERKLE_PROOF,
        result.isValid,
        result,
        durationMs,
        verifierId,
      );
    }

    return result;
  }

  /**
   * Verify the integrity of an entire workflow session.
   * Validates all node hashes and the Merkle root.
   */
  async verifyWorkflowIntegrity(sessionId: string, verifierId?: string): Promise<WorkflowIntegrityReport> {
    const start = Date.now();

    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: { workflowNodes: { orderBy: { stepIndex: 'asc' } }, merkleRoot: true },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    let verifiedNodesCount = 0;
    let tamperedNodesCount = 0;
    let missingNodesCount = 0;
    const tamperedNodes: string[] = [];

    // Verify all nodes
    for (const node of session.workflowNodes) {
      const nodeResult = await this.verifyNodeHash(node.id, verifierId);
      if (nodeResult.status === 'VERIFIED') verifiedNodesCount++;
      else if (nodeResult.status === 'TAMPERED') {
        tamperedNodesCount++;
        tamperedNodes.push(node.id);
      } else missingNodesCount++;
    }

    // Verify Merkle Root
    let isMerkleRootValid = false;
    if (session.merkleRoot) {
      try {
        const tree = await merkleTreeService.buildAndPersistForSession(sessionId);
        isMerkleRootValid = tree.rootHash === session.merkleRoot.rootHash;
      } catch {
        isMerkleRootValid = false;
      }
    }

    const totalNodes = session.workflowNodes.length;
    let overallResult: 'VERIFIED' | 'TAMPERED' | 'INCOMPLETE' = 'VERIFIED';
    
    if (tamperedNodesCount > 0 || (session.merkleRoot && !isMerkleRootValid)) {
      overallResult = 'TAMPERED';
    } else if (missingNodesCount > 0 || !session.merkleRoot) {
      overallResult = 'INCOMPLETE';
    }

    const integrityScore = totalNodes === 0 
      ? 0 
      : Math.round(((verifiedNodesCount / totalNodes) * 100) * (isMerkleRootValid ? 1 : 0));

    const durationMs = Date.now() - start;

    const report: WorkflowIntegrityReport = {
      sessionId,
      workflowId: session.workflowId,
      verificationTime: new Date(),
      totalNodes,
      verifiedNodesCount,
      tamperedNodesCount,
      missingNodesCount,
      tamperedNodes,
      merkleRoot: session.merkleRoot?.rootHash || null,
      isMerkleRootValid,
      overallResult,
      integrityScore,
      durationMs,
    };

    await this.logEvent(
      sessionId,
      VerificationType.WORKFLOW_INTEGRITY,
      overallResult === 'VERIFIED',
      report,
      durationMs,
      verifierId,
    );

    return report;
  }

  /**
   * DEMO: Tamper with a node's data in the database to test verification engine.
   */
  async tamperNode(nodeId: string): Promise<{ success: boolean; message: string }> {
    const node = await prisma.workflowNode.findUnique({ where: { id: nodeId } });
    if (!node) return { success: false, message: 'Node not found' };

    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        // Intentionally tamper with a field
        nodeName: node.nodeName + ' [TAMPERED]',
      },
    });

    return { success: true, message: `Node ${nodeId} has been tampered with.` };
  }
}

export const verificationService = new VerificationService();
