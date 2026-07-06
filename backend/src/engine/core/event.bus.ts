// src/engine/core/event.bus.ts
// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Event Bus — implements IEventBus.
//
// This is a synchronous event bus for the current phase.
// The design is intentionally identical to how Redis Pub/Sub or
// AWS EventBridge would be used — swap the implementation, not the interface.
//
// Lifecycle:
//   Nodes and the Orchestrator emit events.
//   The WorkflowExecutionManager subscribes and logs/monitors.
//   Future: webhook delivery, real-time WebSocket push, metrics.
// ─────────────────────────────────────────────────────────────────────────────

import logger from '../../utils/logger';
import {
  IEventBus,
  WorkflowEvent,
  WorkflowEventType,
  EventHandler,
} from '../interfaces';

export class InMemoryEventBus implements IEventBus {
  /** Map from event type → set of registered handlers */
  private readonly handlers = new Map<WorkflowEventType, Set<EventHandler>>();

  /**
   * Emit an event to all registered handlers.
   * Handlers run synchronously in registration order.
   * Individual handler errors are caught and logged — they never crash the workflow.
   */
  emit(event: WorkflowEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) return;

    handlers.forEach((handler) => {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((err) =>
            logger.error(`[EventBus] Async handler error for ${event.type}: ${err.message}`),
          );
        }
      } catch (err: any) {
        logger.error(`[EventBus] Sync handler error for ${event.type}: ${err.message}`);
      }
    });
  }

  /**
   * Register a handler for a specific event type.
   * Multiple handlers per event are supported.
   */
  on(eventType: WorkflowEventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  /**
   * Unregister a previously registered handler.
   */
  off(eventType: WorkflowEventType, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton instance — shared across the entire workflow engine.
// ─────────────────────────────────────────────────────────────────────────────
export const eventBus = new InMemoryEventBus();
