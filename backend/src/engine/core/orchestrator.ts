// src/engine/core/orchestrator.ts
// ─────────────────────────────────────────────────────────────────────────────
// WorkflowOrchestrator — The Conductor
//
// RESPONSIBILITY: Assemble and execute the 11-stage pipeline in sequence.
//                 Each stage's output becomes the next stage's input.
//                 Failed fault-tolerant stages are skipped gracefully.
//                 Non-fault-tolerant stage failures halt the workflow.
//
// DESIGN: The Orchestrator knows nothing about agents or LLMs.
//         It receives pre-assembled IWorkflowNode[] instances via DI.
//         To reorder stages, change the node array order — no other changes needed.
// ─────────────────────────────────────────────────────────────────────────────

import { SessionStatus } from '@prisma/client';
import logger from '../../utils/logger';
import prisma from '../../utils/prisma';
import { eventBus } from './event.bus';
import {
  IWorkflowNode,
  WorkflowContext,
  WorkflowResult,
  StageResult,
  ResearchRequest,
  EvidenceAggregatorOutput,
  MerkleQueueOutput,
  BlockchainQueueOutput,
  PaymentQueueOutput,
} from '../interfaces';

export class WorkflowOrchestrator {
  /**
   * @param nodes — Ordered array of workflow nodes (11 stages).
   *                The order of this array IS the pipeline order.
   */
  constructor(private readonly nodes: IWorkflowNode[]) {}

  /**
   * Execute the full 11-stage workflow for a research request.
   *
   * Flow:
   *   1. Initialize session status → RUNNING in DB
   *   2. Build WorkflowContext (shared state)
   *   3. Execute each node in sequence, passing output → next input
   *   4. Handle fault-tolerant vs critical failures
   *   5. Finalize session status → COMPLETED / FAILED
   *   6. Assemble and return WorkflowResult
   *
   * @returns WorkflowResult — always returns (never throws to the caller)
   */
  async execute(request: ResearchRequest): Promise<WorkflowResult> {
    const workflowStart = new Date();

    logger.info(
      `[Orchestrator] 🚀 Starting workflow for session ${request.sessionId} — query: "${request.query}"`,
    );

    // ── Update session to RUNNING ────────────────────────────────────────────
    await this.updateSessionStatus(request.sessionId, SessionStatus.RUNNING);

    // ── Emit workflow.started event ──────────────────────────────────────────
    eventBus.emit({
      type: 'workflow.started',
      sessionId: request.sessionId,
      timestamp: workflowStart,
      data: { query: request.query, stageCount: this.nodes.length },
    });

    // ── Build shared WorkflowContext ─────────────────────────────────────────
    const context: WorkflowContext = {
      sessionId: request.sessionId,
      userId: request.userId,
      originalQuery: request.query,
      stageOutputs: {},
      metadata: {
        startedAt: workflowStart,
        failedStages: [],
        retryCount: 0,
      },
    };

    // ── Pipeline execution ───────────────────────────────────────────────────
    const stageResults: StageResult[] = [];
    let currentInput: unknown = request; // First stage receives the full request
    let criticalFailure = false;
    let criticalFailureMessage = '';

    for (const node of this.nodes) {
      if (criticalFailure) {
        logger.warn(
          `[Orchestrator] Skipping ${node.stageName} due to upstream critical failure.`,
        );
        break;
      }

      const result = await node.run(currentInput, context);
      stageResults.push(result);

      if (result.status === 'FAILED') {
        const nodeConfig = (node as any).config;
        const isFaultTolerant = nodeConfig?.isFaultTolerant ?? true;

        if (!isFaultTolerant) {
          criticalFailure = true;
          criticalFailureMessage = `Critical stage ${node.stageName} failed: ${result.error}`;
          logger.error(`[Orchestrator] ❌ ${criticalFailureMessage}`);
          break;
        }

        logger.warn(
          `[Orchestrator] ⚠️  Fault-tolerant stage ${node.stageName} failed. Continuing with null input.`,
        );
        // Pass null input to next stage — it must handle missing upstream data
        currentInput = null;
      } else {
        // Pass this stage's output as the next stage's input
        currentInput = result.output;
      }
    }

    // ── Calculate total duration ─────────────────────────────────────────────
    const workflowEnd = new Date();
    const totalDurationMs = workflowEnd.getTime() - workflowStart.getTime();
    context.metadata.totalDurationMs = totalDurationMs;

    // ── Determine final session status ───────────────────────────────────────
    const finalStatus = criticalFailure ? SessionStatus.FAILED : SessionStatus.COMPLETED;
    await this.updateSessionStatus(request.sessionId, finalStatus);

    // ── Extract key outputs from context ─────────────────────────────────────
    const evidenceOutput = context.stageOutputs['EvidenceAggregatorNode']?.data as
      | EvidenceAggregatorOutput
      | undefined;
    const merkleOutput = context.stageOutputs['MerkleQueueNode']?.data as
      | MerkleQueueOutput
      | undefined;
    const blockchainOutput = context.stageOutputs['BlockchainQueueNode']?.data as
      | BlockchainQueueOutput
      | undefined;
    const paymentOutput = context.stageOutputs['PaymentQueueNode']?.data as
      | PaymentQueueOutput
      | undefined;
    const sourceOutput = context.stageOutputs['SourceCollectionNode']?.data as
      | { sources: Array<{ url: string }> }
      | undefined;

    // ── Emit workflow.completed / workflow.failed ─────────────────────────────
    eventBus.emit({
      type: criticalFailure ? 'workflow.failed' : 'workflow.completed',
      sessionId: request.sessionId,
      timestamp: workflowEnd,
      data: {
        totalDurationMs,
        completedStages: stageResults.filter((r) => r.status === 'COMPLETED').length,
        failedStages: context.metadata.failedStages,
        criticalFailure,
      },
    });

    logger.info(
      `[Orchestrator] ${criticalFailure ? '❌ FAILED' : '✅ COMPLETED'} — session ${request.sessionId} in ${totalDurationMs}ms`,
    );

    // ── Assemble final WorkflowResult ─────────────────────────────────────────
    return {
      sessionId: request.sessionId,
      success: !criticalFailure,
      query: request.query,
      answer: criticalFailure
        ? `Workflow failed: ${criticalFailureMessage}`
        : evidenceOutput?.finalAnswer ?? 'Research completed.',
      sources: sourceOutput?.sources?.map((s) => s.url) ?? [],
      confidence: evidenceOutput?.confidence ?? 0,
      evidenceSummary: evidenceOutput?.evidenceSummary ?? '',
      merkleRootHash: merkleOutput?.rootHash,
      blockchainTxId: blockchainOutput?.txId,
      paymentStatus: paymentOutput?.status,
      stages: stageResults,
      totalDurationMs,
      completedAt: workflowEnd,
    };
  }

  /** Update the ResearchSession status in the DB. */
  private async updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
  ): Promise<void> {
    try {
      await prisma.researchSession.update({
        where: { id: sessionId },
        data: { status },
      });
    } catch (err: any) {
      logger.warn(`[Orchestrator] Could not update session status: ${err.message}`);
    }
  }
}
