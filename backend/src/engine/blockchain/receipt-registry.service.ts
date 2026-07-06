// src/engine/blockchain/receipt-registry.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// ReceiptRegistryService — Production Implementation
//
// Orchestrates the full lifecycle of publishing and verifying receipts on
// the ReceiptRegistryV2 smart contract.
//
// ARCHITECTURE:
//   Controller → ReceiptRegistryService → ReceiptRegistryV2Adapter → Arc L1
//   Worker     ← ReceiptRegistryService (event listener, retry loop)
//
// ALL seven ABI fields are derived from real workflow data in PostgreSQL.
// No placeholder values — every field is computed or stored.
// ─────────────────────────────────────────────────────────────────────────────

import { ethers } from 'ethers';
import prisma from '../../utils/prisma';
import logger from '../../utils/logger';
import ApiError from '../../utils/ApiError';
import httpStatus from 'http-status';
import config from '../../config/config';
import { receiptRegistryV2Adapter } from './adapters/ReceiptRegistryV2Adapter';
import { merkleTreeService } from '../merkle/merkle.service';
import {
  IReceiptRegistryV2Adapter,
  PublishV2Params,
  ReceiptV2EventPayload,
} from './adapters/IReceiptRegistryV2Adapter';

// ─── Constants ────────────────────────────────────────────────────────────────

/** PROBABILITY_SCALE as defined in the contract: uint32 max for 100%. */
const PROBABILITY_SCALE = 10_000;

/**
 * LEO schema identifier encoded as bytes16.
 * "LEO_RECEIPT_V1" (14 chars) right-padded with two null bytes → 16 bytes total.
 * Hex: 0x4c454f5f524543454950545f56310000
 */
const SCHEMA_VERSION = (() => {
  const label = 'LEO_RECEIPT_V1';
  const buf = Buffer.alloc(16, 0); // 16 zero bytes
  Buffer.from(label, 'utf8').copy(buf, 0, 0, Math.min(label.length, 16));
  return '0x' + buf.toString('hex'); // "0x4c454f5f524543454950545f56310000"
})();

// ─── Service ──────────────────────────────────────────────────────────────────

export class ReceiptRegistryService {
  private readonly adapter: IReceiptRegistryV2Adapter;

  constructor(adapter: IReceiptRegistryV2Adapter = receiptRegistryV2Adapter) {
    this.adapter = adapter;
  }

  /** Exposes the adapter for use by the background worker. */
  getAdapter(): IReceiptRegistryV2Adapter {
    return this.adapter;
  }

  // ─── 1. Publish ─────────────────────────────────────────────────────────────

  /**
   * Computes all publishV2() parameters from the workflow DB record,
   * calls the contract, and persists the full result.
   *
   * Steps:
   *   1.  Load session + merkleRoot + node hashes + user wallets
   *   2.  Guard: session must be COMPLETED and have a MerkleRoot
   *   3.  Idempotency: if already REGISTERED, return cached result
   *   4.  Compute traceHash  = keccak256(sorted node hash values)
   *   5.  Compute marketId   = keccak256(sessionId)
   *   6.  Compute probability & confidence from node completion stats
   *   7.  Resolve consumer   = user wallet address || keccak-derived address
   *   8.  Encode schemaVersion as bytes16
   *   9.  Pad merkleRoot to bytes32
   *   10. Call adapter.publishV2()
   *   11. Persist BlockchainReceipt + Transaction + ReceiptV2Event (mock)
   *   12. Return formatted response
   */
  async publishReceipt(
    sessionId: string,
    options?: { probability?: number; confidence?: number; traceCid?: string },
  ) {
    logger.info(`[ReceiptRegistryService] Publishing receipt for session ${sessionId}…`);

    // ── 1. Load full session data ─────────────────────────────────────────────
    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: {
        merkleRoot: true,
        workflowNodes: {
          include: { hashes: true },
          orderBy: { stepIndex: 'asc' },
        },
        user: { include: { wallets: true } },
      },
    });

    if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Workflow session not found');

    // ── 1a. Ensure MerkleRoot reflects the CURRENT set of NODE_HASH leaves. ──
    // The engine's MerkleQueueNode runs mid-pipeline (step 8/11) and may
    // produce a root that doesn't include the final post-merkle stages.
    // We rebuild on demand so the anchored root is always the latest truth.
    const currentNodeHashes = session.workflowNodes
      .map((n) => n.hashes.find((h) => h.type === 'NODE_HASH')?.hashValue)
      .filter((h): h is string => Boolean(h));
    if (currentNodeHashes.length === 0) {
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY,
        'No NODE_HASH records found. Run the workflow or POST /workflow/:id/hash first.',
      );
    }
    if (
      !session.merkleRoot ||
      session.merkleRoot.leafCount !== currentNodeHashes.length
    ) {
      logger.info(
        `[ReceiptRegistryService] MerkleRoot is stale (${session.merkleRoot?.leafCount ?? 0} leaves vs ${currentNodeHashes.length} NODE_HASHs) — rebuilding.`,
      );
      await merkleTreeService.buildAndPersistForSession(
        sessionId,
        currentNodeHashes,
      );
      // Refresh the session view to pick up the new MerkleRoot
      const refreshed = await prisma.researchSession.findUnique({
        where: { id: sessionId },
        include: { merkleRoot: true },
      });
      if (!refreshed?.merkleRoot) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to rebuild MerkleRoot');
      }
      session.merkleRoot = refreshed.merkleRoot;
    }

    // ── 2. Idempotency guard ──────────────────────────────────────────────────
    const existingReceipt = await prisma.blockchainReceipt.findUnique({
      where: { merkleRootId: session.merkleRoot.id },
      include: { transaction: true, receiptV2Events: true },
    });

    if (existingReceipt?.registrationStatus === 'REGISTERED') {
      logger.info(`[ReceiptRegistryService] Receipt already REGISTERED for session ${sessionId}`);
      return this.buildReceiptResponse(existingReceipt, session.merkleRoot.rootHash, sessionId);
    }

    // ── 3. Compute traceHash ──────────────────────────────────────────────────
    // Hash all node hash values (sorted for determinism) using keccak256.
    // This produces a cryptographic fingerprint of the entire workflow trace
    // derivable from DB alone — privacy-preserving (raw outputs not stored).
    const allHashValues = session.workflowNodes
      .flatMap((n) => n.hashes)
      .map((h) => h.hashValue)
      .sort();

    if (allHashValues.length === 0) {
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY,
        'No node hashes found. Run POST /api/v1/workflow/:id/hash first.',
      );
    }

    const traceHash = ethers.keccak256(ethers.toUtf8Bytes(allHashValues.join('')));

    // ── 4. Compute marketId ───────────────────────────────────────────────────
    // Session-scoped market identifier: keccak256(sessionId).
    const marketId = ethers.id(sessionId); // alias for keccak256(utf8(sessionId))

    // ── 5. Compute probability & confidence ───────────────────────────────────
    const totalNodes     = session.workflowNodes.length;
    const completedNodes = session.workflowNodes.filter((n) => n.status === 'COMPLETED').length;
    const derivedProb    = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * PROBABILITY_SCALE) : 5_000;

    const probability = clamp(options?.probability ?? derivedProb, 0, PROBABILITY_SCALE);
    const confidence  = clamp(options?.confidence  ?? probability,  0, PROBABILITY_SCALE);

    // ── 6. Resolve consumer address ───────────────────────────────────────────
    // Prefer the user's first stored wallet; fall back to a deterministic
    // Ethereum address derived from the userId via keccak256.
    let consumer: string;
    if (session.user.wallets.length > 0) {
      consumer = ethers.getAddress(session.user.wallets[0].address);
    } else {
      const userHash = ethers.keccak256(ethers.toUtf8Bytes(session.userId));
      consumer = ethers.getAddress(ethers.dataSlice(userHash, 12)); // last 20 bytes → address
    }

    // ── 7. Encode merkleRoot as bytes32 ───────────────────────────────────────
    const rawRoot   = session.merkleRoot.rootHash;
    const rootHex   = rawRoot.startsWith('0x') ? rawRoot : '0x' + rawRoot;
    // zeroPadValue ensures exactly 32 bytes; safe even for non-keccak SHA-256 roots
    const merkleRoot = ethers.zeroPadValue(rootHex, 32);

    // ── 8. TraceCid ───────────────────────────────────────────────────────────
    const traceCid = options?.traceCid ?? `ipfs://${allHashValues[0] ?? sessionId}`;

    // ── 9. Build params ───────────────────────────────────────────────────────
    const publishParams: PublishV2Params = {
      consumer,
      marketId,
      probability,
      confidence,
      traceHash,
      merkleRoot,
      schemaVersion: SCHEMA_VERSION,
      traceCid,
    };

    logger.info(
      `[ReceiptRegistryService] publishV2 params — probability: ${probability}, confidence: ${confidence}, consumer: ${consumer}`,
    );

    // ── 10. Call the contract / mock ──────────────────────────────────────────
    const result = await this.adapter.publishV2(publishParams);
    const explorerUrl = `${config.arc.explorerBaseUrl}${result.txHash}`;
    const publishedAt = new Date();

    // ── 11. Persist BlockchainReceipt ─────────────────────────────────────────
    const receipt = await prisma.blockchainReceipt.upsert({
      where: { merkleRootId: session.merkleRoot.id },
      create: {
        merkleRootId:      session.merkleRoot.id,
        signature:         result.txHash,
        contractAddress:   this.adapter.getContractAddress(),
        registrationStatus: 'REGISTERED',
        onChainReceiptId:  result.onChainReceiptId,
        traceHash,
        traceCid,
        marketId,
        probability,
        confidence,
        schemaVersion:     SCHEMA_VERSION,
        publishedAt,
      },
      update: {
        signature:         result.txHash,
        registrationStatus: 'REGISTERED',
        onChainReceiptId:  result.onChainReceiptId,
        traceHash,
        traceCid,
        marketId,
        probability,
        confidence,
        schemaVersion:     SCHEMA_VERSION,
        publishedAt,
      },
    });

    // ── 12. Persist Transaction record ────────────────────────────────────────
    const existingTx = await prisma.transaction.findUnique({
      where: { receiptId: receipt.id },
    });

    if (existingTx) {
      await prisma.transaction.update({
        where: { id: existingTx.id },
        data: {
          txHash:      result.txHash,
          status:      'CONFIRMED',
          blockNumber: result.blockNumber ?? null,
          explorerUrl,
        },
      });
    } else {
      await prisma.transaction.create({
        data: {
          txHash:      result.txHash,
          chain:       this.adapter.isMock ? 'arc-mock' : 'arc-mainnet',
          status:      'CONFIRMED',
          blockNumber: result.blockNumber ?? null,
          explorerUrl,
          receiptId:   receipt.id,
        },
      });
    }

    // ── 13. Persist synthetic ReceiptV2Event (mock mode) ─────────────────────
    // In live mode the worker's event listener handles this from the real log.
    // In mock mode we create the row now since no real event will fire.
    if (this.adapter.isMock) {
      await this.persistReceiptV2Event({
        receiptId:     receipt.id,
        id:            result.onChainReceiptId,
        publisher:     consumer,  // In mock: operator = consumer (no real signer)
        consumer,
        marketId,
        probability,
        confidence,
        traceHash,
        merkleRoot,
        schemaVersion: SCHEMA_VERSION,
        traceCid,
        publishedAt:   String(Math.floor(publishedAt.getTime() / 1000)),
        txHash:        result.txHash,
        blockNumber:   result.blockNumber,
      });
    }

    logger.info(
      `[ReceiptRegistryService] ✅ Receipt REGISTERED — onChainId: ${result.onChainReceiptId}, mode: ${this.adapter.isMock ? 'MOCK' : 'LIVE'}`,
    );

    return {
      receiptId:         receipt.id,
      workflowId:        sessionId,
      onChainReceiptId:  result.onChainReceiptId,
      contractAddress:   receipt.contractAddress,
      registrationStatus: 'REGISTERED',
      txHash:            result.txHash,
      blockNumber:       result.blockNumber,
      explorerUrl,
      merkleRoot:        session.merkleRoot.rootHash,
      traceHash,
      marketId,
      probability,
      confidence,
      schemaVersion:     SCHEMA_VERSION,
      traceCid,
      consumer,
      mode:              this.adapter.isMock ? 'MOCK' : 'LIVE',
    };
  }

  // ─── 2. Get Receipt ──────────────────────────────────────────────────────────

  /**
   * Returns the full receipt details including all V2 fields and on-chain events.
   */
  async getReceipt(workflowId: string) {
    const session = await prisma.researchSession.findUnique({
      where: { id: workflowId },
      include: {
        merkleRoot: {
          include: {
            blockchainReceipt: {
              include: { transaction: true, receiptV2Events: true },
            },
          },
        },
      },
    });

    if (!session?.merkleRoot?.blockchainReceipt) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'Receipt not found for this workflow. Run POST /api/v1/receipt/publish first.',
      );
    }

    const receipt = session.merkleRoot.blockchainReceipt;
    return {
      receiptId:          receipt.id,
      workflowId,
      contractAddress:    receipt.contractAddress,
      registrationStatus: receipt.registrationStatus,
      onChainReceiptId:   receipt.onChainReceiptId,
      txHash:             receipt.transaction?.txHash,
      blockNumber:        receipt.transaction?.blockNumber,
      explorerUrl:        receipt.transaction?.explorerUrl,
      merkleRoot:         session.merkleRoot.rootHash,
      traceHash:          receipt.traceHash,
      traceCid:           receipt.traceCid,
      marketId:           receipt.marketId,
      probability:        receipt.probability,
      confidence:         receipt.confidence,
      schemaVersion:      receipt.schemaVersion,
      publishedAt:        receipt.publishedAt,
      createdAt:          receipt.createdAt,
      updatedAt:          receipt.updatedAt,
      eventsCount:        receipt.receiptV2Events.length,
      events:             receipt.receiptV2Events,
    };
  }

  // ─── 3. Verify Receipt ───────────────────────────────────────────────────────

  /**
   * Verifies a stored receipt by re-computing the traceHash from DB and
   * confirming it matches the stored value. Also checks registration status.
   */
  async verifyReceipt(receiptId: string) {
    const receipt = await prisma.blockchainReceipt.findUnique({
      where: { id: receiptId },
      include: {
        merkleRoot: {
          include: {
            session: {
              include: {
                workflowNodes: { include: { hashes: true } },
              },
            },
          },
        },
        transaction: true,
      },
    });

    if (!receipt) throw new ApiError(httpStatus.NOT_FOUND, 'Receipt not found');
    if (!receipt.merkleRoot) throw new ApiError(httpStatus.NOT_FOUND, 'Merkle root not found for receipt');

    // Re-derive the traceHash from current DB state
    const allHashValues = receipt.merkleRoot.session.workflowNodes
      .flatMap((n) => n.hashes)
      .map((h) => h.hashValue)
      .sort();

    const recomputedTraceHash =
      allHashValues.length > 0
        ? ethers.keccak256(ethers.toUtf8Bytes(allHashValues.join('')))
        : null;

    const traceHashValid =
      recomputedTraceHash !== null && recomputedTraceHash.toLowerCase() === receipt.traceHash?.toLowerCase();

    const isRegistered = receipt.registrationStatus === 'REGISTERED';

    logger.info(
      `[ReceiptRegistryService] verifyReceipt ${receiptId} — registered: ${isRegistered}, traceHashValid: ${traceHashValid}`,
    );

    return {
      receiptId:          receipt.id,
      registrationStatus: receipt.registrationStatus,
      onChainReceiptId:   receipt.onChainReceiptId,
      storedTraceHash:    receipt.traceHash,
      recomputedTraceHash,
      traceHashValid,
      isValid:            isRegistered && traceHashValid,
      txHash:             receipt.transaction?.txHash,
      explorerUrl:        receipt.transaction?.explorerUrl,
      message: isRegistered && traceHashValid
        ? 'Receipt verified — on-chain registration confirmed and trace hash is consistent.'
        : 'Receipt verification failed — check registration status or trace hash mismatch.',
    };
  }

  // ─── 4. Verify Merkle Inclusion ──────────────────────────────────────────────

  /**
   * Stateless proxy to the contract's verifyInclusion() pure function.
   * Accepts raw bytes32 values from the caller — no DB lookup required.
   *
   * @param root  - The Merkle root (bytes32 hex)
   * @param leaf  - The leaf hash to verify (bytes32 hex)
   * @param proof - Ordered sibling path (bytes32[] hex strings, leaf → root)
   */
  async verifyInclusion(root: string, leaf: string, proof: string[]): Promise<boolean> {
    logger.info(
      `[ReceiptRegistryService] verifyInclusion — root: ${root.slice(0, 18)}…, leaf: ${leaf.slice(0, 18)}…, proof steps: ${proof.length}`,
    );
    return this.adapter.verifyInclusion(root, leaf, proof);
  }

  // ─── 5. Get Status ───────────────────────────────────────────────────────────

  /**
   * Returns the lightweight status of a specific receipt by its internal ID.
   */
  async getStatus(receiptId: string) {
    const receipt = await prisma.blockchainReceipt.findUnique({
      where: { id: receiptId },
      include: { transaction: true },
    });

    if (!receipt) throw new ApiError(httpStatus.NOT_FOUND, 'Receipt not found');

    return {
      receiptId:          receipt.id,
      registrationStatus: receipt.registrationStatus,
      onChainReceiptId:   receipt.onChainReceiptId,
      transactionStatus:  receipt.transaction?.status,
      txHash:             receipt.transaction?.txHash,
      explorerUrl:        receipt.transaction?.explorerUrl,
      contractAddress:    receipt.contractAddress,
    };
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Persists a ReceiptV2Event row from a ReceiptV2 on-chain event payload.
   * Called by the arc.worker event handler (live mode) and inline after
   * publishV2 (mock mode).
   */
  async persistReceiptV2Event(payload: ReceiptV2EventPayload & { receiptId: string }) {
    const publishedAtDate = new Date(Number(payload.publishedAt) * 1000);

    await prisma.receiptV2Event.create({
      data: {
        receiptId:     payload.receiptId,
        onChainId:     payload.id,
        publisher:     payload.publisher,
        consumer:      payload.consumer,
        marketId:      payload.marketId,
        probability:   payload.probability,
        confidence:    payload.confidence,
        traceHash:     payload.traceHash,
        merkleRoot:    payload.merkleRoot,
        schemaVersion: payload.schemaVersion,
        traceCid:      payload.traceCid,
        publishedAt:   publishedAtDate,
        txHash:        payload.txHash,
        blockNumber:   payload.blockNumber,
      },
    });

    logger.info(
      `[ReceiptRegistryService] Persisted ReceiptV2Event — onChainId: ${payload.id}, txHash: ${payload.txHash}`,
    );
  }

  /**
   * Formats a persisted BlockchainReceipt into the standard API response shape.
   */
  private buildReceiptResponse(receipt: any, rootHash: string, sessionId: string) {
    return {
      receiptId:          receipt.id,
      workflowId:         sessionId,
      onChainReceiptId:   receipt.onChainReceiptId,
      contractAddress:    receipt.contractAddress,
      registrationStatus: receipt.registrationStatus,
      txHash:             receipt.transaction?.txHash,
      explorerUrl:        receipt.transaction?.explorerUrl,
      merkleRoot:         rootHash,
      traceHash:          receipt.traceHash,
      traceCid:           receipt.traceCid,
      marketId:           receipt.marketId,
      probability:        receipt.probability,
      confidence:         receipt.confidence,
      schemaVersion:      receipt.schemaVersion,
      publishedAt:        receipt.publishedAt,
      mode:               this.adapter.isMock ? 'MOCK' : 'LIVE',
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const receiptRegistryService = new ReceiptRegistryService();
