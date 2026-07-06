// src/engine/core/base.node.ts
// ─────────────────────────────────────────────────────────────────────────────
// BaseWorkflowNode — Abstract base class implementing IWorkflowNode.
//
// This is the most important class in the engine.
// Every workflow stage (Planner, Research, Validation, etc.) extends this class.
//
// Responsibilities:
//   1. DB record lifecycle: QUEUED → RUNNING → COMPLETED/FAILED
//   2. Retry logic with configurable max attempts and exponential backoff
//   3. Execution timing (start, end, duration)
//   4. SHA-256 hashing of input and output
//   5. Event emission on every state change
//   6. Error isolation: failed stage returns StageResult, never throws
//
// Adding a new workflow stage = extend BaseWorkflowNode, implement execute().
// All infrastructure (retries, persistence, events) is inherited for free.
// ─────────────────────────────────────────────────────────────────────────────

import { NodeStatus } from '@prisma/client';
import logger from '../../utils/logger';
import { sha256 } from '../utils/hash.utils';
import { eventBus } from './event.bus';
import {
  IWorkflowNode,
  IAgent,
  INodePersistence,
  WorkflowContext,
  StageResult,
} from '../interfaces';

/** Configuration for retry behavior. */
export interface NodeConfig {
  maxRetries: number;
  /** Base delay in ms — actual delay = baseDelayMs * 2^attempt (exponential backoff) */
  baseDelayMs: number;
  /** If true, a failure in this stage is considered non-fatal for the overall workflow */
  isFaultTolerant: boolean;
}

const DEFAULT_NODE_CONFIG: NodeConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  isFaultTolerant: true,
};

export abstract class BaseWorkflowNode implements IWorkflowNode {
  abstract readonly stageName: string;
  abstract readonly stepIndex: number;

  protected readonly config: NodeConfig;

  constructor(
    /** The AI agent that performs this stage's task */
    protected readonly agent: IAgent,
    /** DB persistence service */
    protected readonly persistence: INodePersistence,
    config: Partial<NodeConfig> = {},
  ) {
    this.config = { ...DEFAULT_NODE_CONFIG, ...config };
  }

  /**
   * Run this workflow stage with full retry logic and DB persistence.
   *
   * Never throws. On final failure, returns a StageResult with status=FAILED.
   * The orchestrator decides whether to halt or continue based on isFaultTolerant.
   */
  async run(input: unknown, context: WorkflowContext): Promise<StageResult> {
    const startTime = new Date();
    let nodeId = '';
    let lastError: Error | null = null;
    let attempt = 0;

    // Compute input hash before any execution (hash of raw input)
    const inputHash = sha256(input);

    logger.info(
      `[${this.stageName}] Starting (step ${this.stepIndex}, session ${context.sessionId})`,
    );

    // ── Create the DB record in QUEUED status ──────────────────────────────
    try {
      nodeId = await this.persistence.createNode({
        sessionId: context.sessionId,
        stepIndex: this.stepIndex,
        nodeName: this.stageName,
        agentDid: this.agent.agentDid,
      });
    } catch (dbErr: any) {
      logger.error(`[${this.stageName}] Failed to create DB node: ${dbErr.message}`);
      // Non-recoverable — return a failed result without a nodeId
      return this.buildFailedResult('', input, dbErr, startTime, 0);
    }

    // ── Emit stage.started event ───────────────────────────────────────────
    eventBus.emit({
      type: 'stage.started',
      sessionId: context.sessionId,
      stageName: this.stageName,
      stepIndex: this.stepIndex,
      timestamp: startTime,
      data: { nodeId },
    });

    // ── Mark RUNNING ───────────────────────────────────────────────────────
    await this.persistence.markRunning(nodeId).catch((e) =>
      logger.warn(`[${this.stageName}] markRunning failed: ${e.message}`),
    );

    // ── Retry Loop ─────────────────────────────────────────────────────────
    while (attempt <= this.config.maxRetries) {
      try {
        if (attempt > 0) {
          const delay = this.config.baseDelayMs * Math.pow(2, attempt - 1);
          logger.warn(`[${this.stageName}] Retry attempt ${attempt} after ${delay}ms`);

          eventBus.emit({
            type: 'stage.retrying',
            sessionId: context.sessionId,
            stageName: this.stageName,
            stepIndex: this.stepIndex,
            timestamp: new Date(),
            data: { attempt, delay },
          });

          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // ── Execute the agent ────────────────────────────────────────────
        const output = await this.agent.execute(input, context);
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        const outputHash = sha256(output);

        // ── Persist hashes ────────────────────────────────────────────
        await this.persistence.saveHashes(nodeId, inputHash, outputHash).catch((e) =>
          logger.warn(`[${this.stageName}] saveHashes failed: ${e.message}`),
        );

        // ── Mark COMPLETED ────────────────────────────────────────────
        await this.persistence.markCompleted(nodeId, endTime).catch((e) =>
          logger.warn(`[${this.stageName}] markCompleted failed: ${e.message}`),
        );

        // ── Generate canonical NODE_HASH for the verify engine ────────
        await this.persistence.generateNodeHash(nodeId).catch((e) =>
          logger.warn(`[${this.stageName}] generateNodeHash failed: ${e.message}`),
        );

        // ── Write to context for downstream stages ────────────────────
        context.stageOutputs[this.stageName] = {
          stageName: this.stageName,
          success: true,
          data: output,
          durationMs,
          timestamp: endTime,
        };

        // ── Emit stage.completed ──────────────────────────────────────
        eventBus.emit({
          type: 'stage.completed',
          sessionId: context.sessionId,
          stageName: this.stageName,
          stepIndex: this.stepIndex,
          timestamp: endTime,
          data: { nodeId, durationMs, outputHash },
        });

        logger.info(
          `[${this.stageName}] ✅ Completed in ${durationMs}ms (attempt ${attempt + 1})`,
        );

        return {
          nodeId,
          stageName: this.stageName,
          stepIndex: this.stepIndex,
          agentDid: this.agent.agentDid,
          status: NodeStatus.COMPLETED,
          input,
          output,
          durationMs,
          startTime,
          endTime,
          retryCount: attempt,
        };
      } catch (err: any) {
        lastError = err;
        attempt++;
        logger.warn(`[${this.stageName}] Attempt ${attempt} failed: ${err.message}`);
      }
    }

    // ── All retries exhausted — mark FAILED ────────────────────────────────
    const endTime = new Date();

    await this.persistence.markFailed(nodeId, endTime).catch((e) =>
      logger.warn(`[${this.stageName}] markFailed failed: ${e.message}`),
    );

    context.stageOutputs[this.stageName] = {
      stageName: this.stageName,
      success: false,
      data: null,
      durationMs: endTime.getTime() - startTime.getTime(),
      timestamp: endTime,
    };
    context.metadata.failedStages.push(this.stageName);

    eventBus.emit({
      type: 'stage.failed',
      sessionId: context.sessionId,
      stageName: this.stageName,
      stepIndex: this.stepIndex,
      timestamp: endTime,
      data: { nodeId, error: lastError?.message },
    });

    logger.error(
      `[${this.stageName}] ❌ Failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
    );

    return this.buildFailedResult(nodeId, input, lastError!, startTime, this.config.maxRetries);
  }

  /** Helper: build a StageResult for failure cases. */
  private buildFailedResult(
    nodeId: string,
    input: unknown,
    error: Error,
    startTime: Date,
    retryCount: number,
  ): StageResult {
    const endTime = new Date();
    return {
      nodeId,
      stageName: this.stageName,
      stepIndex: this.stepIndex,
      agentDid: this.agent.agentDid,
      status: NodeStatus.FAILED,
      input,
      output: null,
      durationMs: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
      retryCount,
      error: error?.message ?? 'Unknown error',
    };
  }
}
