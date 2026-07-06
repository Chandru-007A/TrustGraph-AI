// src/engine/core/execution.manager.ts
// ─────────────────────────────────────────────────────────────────────────────
// WorkflowExecutionManager — Dependency Injection Container
//
// RESPONSIBILITY: Wire all dependencies together and expose a clean execute() API.
//
// This is the ONLY place where concrete implementations are instantiated:
//   - Mock agents are injected into nodes
//   - NodePersistenceService is injected into nodes
//   - Nodes are injected into the Orchestrator
//
// To swap MockPlannerAgent → RealGPT4PlannerAgent:
//   1. Import the real agent class
//   2. Replace the injection line here
//   3. Zero other file changes
//
// Also registers event bus listeners for observability.
// ─────────────────────────────────────────────────────────────────────────────

import logger from '../../utils/logger';
import { WorkflowOrchestrator } from './orchestrator';
import { eventBus } from './event.bus';
import { NodePersistenceService } from '../utils/node.persistence';
import { WorkflowResult, ResearchRequest, WorkflowEvent } from '../interfaces';

// ── Production AI Agents ───────────────────────────────────────────────────
import { ProductionPlannerAgent } from '../agents/production/planner.agent';
import { ProductionResearchAgent } from '../agents/production/research.agent';
import { ProductionSourceCollectionAgent } from '../agents/production/source-collection.agent';
import { ProductionValidationAgent } from '../agents/production/validation.agent';
import { ProductionReasoningAgent } from '../agents/production/reasoning.agent';
import { ProductionEvidenceAggregatorAgent } from '../agents/production/evidence-aggregator.agent';
import { ProductionSummaryAgent } from '../agents/production/summary.agent';
import { ProductionBlockchainQueueAgent } from '../agents/production/blockchain-queue.agent';

// ── Infrastructure Agents (Still Mocked/Simulated) ─────────────────────────
import { MockHashQueueAgent } from '../agents/mock/hash-queue.agent';
import { MockMerkleQueueAgent } from '../agents/mock/merkle-queue.agent';
import { MockPaymentQueueAgent } from '../agents/mock/payment-queue.agent';

// ── Workflow Nodes ────────────────────────────────────────────────────────────
import {
  PlannerNode,
  ResearchNode,
  SourceCollectionNode,
  ValidationNode,
  ReasoningNode,
  EvidenceAggregatorNode,
  WorkflowRecorderNode,
  HashQueueNode,
  MerkleQueueNode,
  BlockchainQueueNode,
  PaymentQueueNode,
} from '../nodes';

export class WorkflowExecutionManager {
  private readonly orchestrator: WorkflowOrchestrator;

  constructor() {
    // ── Shared dependencies ────────────────────────────────────────────────
    const persistence = new NodePersistenceService();

    // ── Instantiate agents ─────────────────────────────────────────────────
    const plannerAgent        = new ProductionPlannerAgent();
    const researchAgent       = new ProductionResearchAgent();
    const sourceAgent         = new ProductionSourceCollectionAgent();
    const validationAgent     = new ProductionValidationAgent();
    const reasoningAgent      = new ProductionReasoningAgent();
    const aggregatorAgent     = new ProductionEvidenceAggregatorAgent();
    const recorderAgent       = new ProductionSummaryAgent();
    const hashAgent           = new MockHashQueueAgent();
    const merkleAgent         = new MockMerkleQueueAgent();
    const blockchainAgent     = new ProductionBlockchainQueueAgent();
    const paymentAgent        = new MockPaymentQueueAgent();

    // ── Assemble pipeline (ORDER DEFINES EXECUTION SEQUENCE) ──────────────
    const pipeline = [
      new PlannerNode(plannerAgent, persistence),            // Step 0
      new ResearchNode(researchAgent, persistence),          // Step 1
      new SourceCollectionNode(sourceAgent, persistence),    // Step 2
      new ValidationNode(validationAgent, persistence),      // Step 3
      new ReasoningNode(reasoningAgent, persistence),        // Step 4
      new EvidenceAggregatorNode(aggregatorAgent, persistence), // Step 5
      new WorkflowRecorderNode(recorderAgent, persistence),  // Step 6
      new HashQueueNode(hashAgent, persistence),             // Step 7
      new MerkleQueueNode(merkleAgent, persistence),         // Step 8
      new BlockchainQueueNode(blockchainAgent, persistence), // Step 9
      new PaymentQueueNode(paymentAgent, persistence),       // Step 10
    ];

    // ── Inject pipeline into Orchestrator ─────────────────────────────────
    this.orchestrator = new WorkflowOrchestrator(pipeline);

    // ── Register observability listeners ─────────────────────────────────
    this.registerEventListeners();
  }

  /**
   * Public API: Execute a workflow for a research request.
   * Returns WorkflowResult — always (never throws).
   */
  async execute(request: ResearchRequest): Promise<WorkflowResult> {
    return this.orchestrator.execute(request);
  }

  /**
   * Register event bus listeners for logging and observability.
   * In production: add webhook delivery, metrics, Slack alerts, etc.
   */
  private registerEventListeners(): void {
    eventBus.on('workflow.started', (e: WorkflowEvent) => {
      logger.info(
        `📊 [EVENT] workflow.started — session: ${e.sessionId} | stages: ${(e.data as any)?.stageCount}`,
      );
    });

    eventBus.on('stage.started', (e: WorkflowEvent) => {
      logger.debug(
        `  ▶ [EVENT] stage.started — ${e.stageName} (step ${e.stepIndex})`,
      );
    });

    eventBus.on('stage.completed', (e: WorkflowEvent) => {
      logger.info(
        `  ✅ [EVENT] stage.completed — ${e.stageName} in ${(e.data as any)?.durationMs}ms`,
      );
    });

    eventBus.on('stage.failed', (e: WorkflowEvent) => {
      logger.error(
        `  ❌ [EVENT] stage.failed — ${e.stageName}: ${(e.data as any)?.error}`,
      );
    });

    eventBus.on('stage.retrying', (e: WorkflowEvent) => {
      logger.warn(
        `  🔁 [EVENT] stage.retrying — ${e.stageName} attempt ${(e.data as any)?.attempt}`,
      );
    });

    eventBus.on('workflow.completed', (e: WorkflowEvent) => {
      const d = e.data as any;
      logger.info(
        `📊 [EVENT] workflow.completed — session: ${e.sessionId} | ${d?.completedStages} stages | ${d?.totalDurationMs}ms`,
      );
    });

    eventBus.on('workflow.failed', (e: WorkflowEvent) => {
      logger.error(
        `📊 [EVENT] workflow.failed — session: ${e.sessionId} | failed: ${(e.data as any)?.failedStages?.join(', ')}`,
      );
    });
  }
}

// ── Singleton instance — one ExecutionManager per process ─────────────────────
export const workflowExecutionManager = new WorkflowExecutionManager();
