// src/engine/queues/in-memory.queue.ts
// ─────────────────────────────────────────────────────────────────────────────
// InMemoryQueue — implements IQueue<T>
//
// A simple in-process FIFO queue for the current development phase.
// The interface is identical to how Bull, RabbitMQ, or AWS SQS queues work.
//
// To upgrade to Bull/RabbitMQ:
//   1. Create BullQueue<T> or RabbitMQQueue<T> implementing IQueue<T>
//   2. Inject the new implementation into the Orchestrator
//   3. Zero changes to nodes, agents, or orchestration logic
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import { IQueue, QueueJob } from '../interfaces';
import logger from '../../utils/logger';

export class InMemoryQueue<T> implements IQueue<T> {
  readonly name: string;
  private readonly jobs: QueueJob<T>[] = [];
  private readonly maxAttempts: number;

  constructor(name: string, maxAttempts = 3) {
    this.name = name;
    this.maxAttempts = maxAttempts;
  }

  /**
   * Add a new job to the back of the queue (FIFO).
   */
  async enqueue(payload: T): Promise<void> {
    const job: QueueJob<T> = {
      id: uuidv4(),
      payload,
      enqueuedAt: new Date(),
      attempts: 0,
      maxAttempts: this.maxAttempts,
    };
    this.jobs.push(job);
    logger.debug(`[Queue:${this.name}] Enqueued job ${job.id}. Queue size: ${this.jobs.length}`);
  }

  /**
   * Remove and return the job at the front of the queue.
   * Returns null if the queue is empty.
   */
  async dequeue(): Promise<T | null> {
    const job = this.jobs.shift();
    if (!job) return null;
    job.attempts++;
    logger.debug(`[Queue:${this.name}] Dequeued job ${job.id} (attempt ${job.attempts})`);
    return job.payload;
  }

  /**
   * Inspect the front item without removing it.
   */
  async peek(): Promise<T | null> {
    return this.jobs[0]?.payload ?? null;
  }

  async size(): Promise<number> {
    return this.jobs.length;
  }

  async isEmpty(): Promise<boolean> {
    return this.jobs.length === 0;
  }

  /**
   * Drain the queue — used for cleanup between workflow runs.
   */
  async clear(): Promise<void> {
    this.jobs.length = 0;
    logger.debug(`[Queue:${this.name}] Cleared`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-instantiated queues — one per pipeline stage that uses queuing semantics.
// The orchestrator imports these directly.
// ─────────────────────────────────────────────────────────────────────────────
import { HashQueueOutput, MerkleQueueOutput, BlockchainQueueOutput, PaymentQueueOutput } from '../interfaces';

export const hashQueue = new InMemoryQueue<HashQueueOutput>('HashQueue');
export const merkleQueue = new InMemoryQueue<MerkleQueueOutput>('MerkleQueue');
export const blockchainQueue = new InMemoryQueue<BlockchainQueueOutput>('BlockchainQueue');
export const paymentQueue = new InMemoryQueue<PaymentQueueOutput>('PaymentQueue');
