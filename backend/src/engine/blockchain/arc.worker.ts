// src/engine/blockchain/arc.worker.ts
// ─────────────────────────────────────────────────────────────────────────────
// ArcBlockchainWorker — Background Worker
//
// Two responsibilities:
//   1. EVENT LISTENER  — Attaches to the ReceiptRegistryV2 contract's ReceiptV2
//      event stream and persists every emitted field into PostgreSQL in real-time.
//      (Live mode only — in mock mode the service persists the event synchronously.)
//
//   2. RETRY LOOP — Polls every 15 s for BlockchainReceipts stuck in PENDING state
//      (e.g., caused by a server crash mid-publish) and retries publishing via the
//      service. Gives up after MAX_RETRIES, marking the receipt as FAILED.
// ─────────────────────────────────────────────────────────────────────────────

import prisma from '../../utils/prisma';
import logger from '../../utils/logger';
import { receiptRegistryService } from './receipt-registry.service';
import { ReceiptV2EventPayload } from './adapters/IReceiptRegistryV2Adapter';

const MAX_RETRIES      = 5;
const POLL_INTERVAL_MS = 15_000; // 15 seconds

export class ArcBlockchainWorker {
  private isRunning   = false;
  private intervalId: NodeJS.Timeout | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const adapter = receiptRegistryService.getAdapter();

    logger.info(
      `[ArcWorker] Started — mode: ${adapter.isMock ? 'MOCK' : 'LIVE'}, poll: ${POLL_INTERVAL_MS / 1000}s`,
    );

    // Attach the ReceiptV2 event listener (no-op in mock mode — events are
    // created synchronously by the service after each publishV2 call).
    adapter.listenForReceiptV2(this.handleReceiptV2Event.bind(this));

    // Kick off the retry poller immediately, then on interval
    this.processPendingReceipts();
    this.intervalId = setInterval(() => this.processPendingReceipts(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    receiptRegistryService.getAdapter().disconnect();
    this.isRunning = false;
    logger.info('[ArcWorker] Stopped — event listeners removed.');
  }

  // ─── Event Handler ────────────────────────────────────────────────────────────

  /**
   * Called every time a ReceiptV2 event is emitted on-chain.
   * Finds the matching BlockchainReceipt in the DB (by merkleRoot) and persists
   * a ReceiptV2Event row with every event field.
   * In mock mode this is never called — the service creates the event row itself.
   */
  private async handleReceiptV2Event(payload: ReceiptV2EventPayload): Promise<void> {
    logger.info(
      `[ArcWorker:Event] ReceiptV2 received — onChainId: ${payload.id}, txHash: ${payload.txHash}`,
    );

    try {
      // Locate the BlockchainReceipt by matching the on-chain merkleRoot field
      const receipt = await prisma.blockchainReceipt.findFirst({
        where: { merkleRoot: { rootHash: payload.merkleRoot } },
      });

      if (!receipt) {
        logger.warn(
          `[ArcWorker:Event] No BlockchainReceipt found for merkleRoot ${payload.merkleRoot} — event not persisted.`,
        );
        return;
      }

      // Persist the full event payload
      await receiptRegistryService.persistReceiptV2Event({
        receiptId: receipt.id,
        ...payload,
      });

      // Update the receipt with the confirmed on-chain id if not already set
      if (!receipt.onChainReceiptId) {
        await prisma.blockchainReceipt.update({
          where: { id: receipt.id },
          data: {
            onChainReceiptId:   payload.id,
            registrationStatus: 'REGISTERED',
            publishedAt:        new Date(Number(payload.publishedAt) * 1000),
          },
        });
      }
    } catch (err: any) {
      logger.error(`[ArcWorker:Event] Failed to handle ReceiptV2 event: ${err.message}`);
    }
  }

  // ─── Retry Loop ───────────────────────────────────────────────────────────────

  /**
   * Finds all BlockchainReceipts stuck in PENDING status and retries publishing.
   * These can accumulate if the server crashed between creating the receipt record
   * and completing the publishV2() call.
   */
  private async processPendingReceipts(): Promise<void> {
    try {
      const pendingReceipts = await prisma.blockchainReceipt.findMany({
        where: { registrationStatus: 'PENDING' },
        include: {
          merkleRoot: {
            include: { session: true },
          },
          transaction: true,
        },
      });

      if (pendingReceipts.length === 0) return;

      logger.info(`[ArcWorker] Found ${pendingReceipts.length} PENDING receipt(s) — retrying…`);

      for (const receipt of pendingReceipts) {
        await this.retryPendingReceipt(receipt);
      }
    } catch (err: any) {
      logger.error(`[ArcWorker] Retry loop error: ${err.message}`);
    }
  }

  private async retryPendingReceipt(receipt: any): Promise<void> {
    const retryCount = receipt.transaction?.retryCount ?? 0;

    if (retryCount >= MAX_RETRIES) {
      await this.markFailed(receipt.id, receipt.transaction?.id, `Max retries (${MAX_RETRIES}) reached`);
      return;
    }

    if (!receipt.merkleRoot?.session) {
      await this.markFailed(receipt.id, undefined, 'No session linked to this receipt');
      return;
    }

    const sessionId = receipt.merkleRoot.session.id;
    logger.info(`[ArcWorker] Retrying publishReceipt for session ${sessionId}…`);

    try {
      await receiptRegistryService.publishReceipt(sessionId);
      logger.info(`[ArcWorker] ✅ Retry succeeded for session ${sessionId}`);
    } catch (err: any) {
      logger.warn(`[ArcWorker] Retry failed for session ${sessionId}: ${err.message}`);
      if (receipt.transaction) {
        await prisma.transaction.update({
          where: { id: receipt.transaction.id },
          data: {
            retryCount: retryCount + 1,
            lastError:  err.message,
            status:     retryCount + 1 >= MAX_RETRIES ? 'FAILED' : 'PENDING',
          },
        });
      }
    }
  }

  // ─── DB Helpers ───────────────────────────────────────────────────────────────

  private async markFailed(receiptId: string, txId: string | undefined, reason: string): Promise<void> {
    logger.warn(`[ArcWorker] Permanently marking receipt ${receiptId} as FAILED: ${reason}`);

    const ops: any[] = [
      prisma.blockchainReceipt.update({
        where: { id: receiptId },
        data: { registrationStatus: 'FAILED' },
      }),
      prisma.contractEvent.create({
        data: {
          receiptId,
          eventName: 'RegistrationFailed',
          eventData: { reason, failedAt: new Date().toISOString() },
        },
      }),
    ];

    if (txId) {
      ops.push(
        prisma.transaction.update({
          where: { id: txId },
          data: { status: 'FAILED', lastError: reason },
        }),
      );
    }

    await prisma.$transaction(ops);
  }
}

export const arcWorker = new ArcBlockchainWorker();
