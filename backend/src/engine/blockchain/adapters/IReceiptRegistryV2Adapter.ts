// src/engine/blockchain/adapters/IReceiptRegistryV2Adapter.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typed interface for the ReceiptRegistryV2 smart contract.
// Every method maps 1:1 to an ABI function or event.
// ─────────────────────────────────────────────────────────────────────────────

// ─── publishV2() parameter bag ────────────────────────────────────────────────

/**
 * All 8 parameters required by publishV2() exactly as the ABI defines them.
 * Type annotations reflect the Solidity types:
 *   consumer       → address   (checksummed hex string, 42 chars)
 *   marketId       → bytes32   ("0x" + 64 hex chars)
 *   probability    → uint32    (integer 0–10000, where 10000 = PROBABILITY_SCALE)
 *   confidence     → uint32    (integer 0–10000)
 *   traceHash      → bytes32   ("0x" + 64 hex chars)
 *   merkleRoot     → bytes32   ("0x" + 64 hex chars)
 *   schemaVersion  → bytes16   ("0x" + 32 hex chars, right-padded with \0)
 *   traceCid       → string    (IPFS CID or any UTF-8 string)
 */
export interface PublishV2Params {
  consumer: string;
  marketId: string;
  probability: number;
  confidence: number;
  traceHash: string;
  merkleRoot: string;
  schemaVersion: string;
  traceCid: string;
}

// ─── publishV2() return ───────────────────────────────────────────────────────

/**
 * Returned after a successful publishV2() call.
 * onChainReceiptId: the uint256 id emitted in the ReceiptV2 event (as string to
 *                   avoid JS BigInt precision loss).
 */
export interface PublishV2Result {
  txHash: string;
  onChainReceiptId: string;
  blockNumber?: number;
}

// ─── ReceiptV2 event payload ──────────────────────────────────────────────────

/**
 * Every field emitted by the ReceiptV2 on-chain event.
 * Numeric Solidity types (uint32, uint64, uint256) are carried as strings or
 * numbers based on magnitude to avoid precision loss.
 */
export interface ReceiptV2EventPayload {
  /** uint256 id — unique on-chain receipt identifier */
  id: string;
  /** address publisher — the operator who called publishV2 */
  publisher: string;
  /** address consumer — the end-consumer of the AI output */
  consumer: string;
  /** bytes32 marketId — session-scoped market identifier */
  marketId: string;
  /** uint32 probability — 0–10000 (PROBABILITY_SCALE = 10000) */
  probability: number;
  /** uint32 confidence — 0–10000 */
  confidence: number;
  /** bytes32 traceHash — keccak256 fingerprint of the full workflow trace */
  traceHash: string;
  /** bytes32 merkleRoot — the Merkle root anchored by this receipt */
  merkleRoot: string;
  /** bytes16 schemaVersion — e.g. 0x4c454f5f524543454950545f56310000 */
  schemaVersion: string;
  /** string traceCid — IPFS CID pointing to the full trace */
  traceCid: string;
  /** uint64 publishedAt — Unix timestamp (seconds) as string */
  publishedAt: string;
  /** Transaction hash of the tx that emitted this event */
  txHash: string;
  /** Block number of the emitting block */
  blockNumber?: number;
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface IReceiptRegistryV2Adapter {
  /**
   * Returns the deployed contract address being used.
   */
  getContractAddress(): string;

  /**
   * Calls publishV2() on the ReceiptRegistryV2 contract.
   * Waits for 1 confirmation before returning.
   * In mock mode: simulates the transaction and returns synthetic values.
   */
  publishV2(params: PublishV2Params): Promise<PublishV2Result>;

  /**
   * Calls verifyInclusion(root, leaf, proof) — a pure Solidity view function.
   * Returns true if the leaf is provably included in the Merkle tree with
   * the given root, using the sibling proof path provided.
   * In mock mode: performs local verification using the same algorithm.
   */
  verifyInclusion(root: string, leaf: string, proof: string[]): Promise<boolean>;

  /**
   * Attaches a real-time event listener on the ReceiptV2 event.
   * In live mode: calls contract.on('ReceiptV2', handler).
   * In mock mode: no-op (events are emitted synchronously after publishV2).
   */
  listenForReceiptV2(handler: (event: ReceiptV2EventPayload) => void): void;

  /**
   * Removes all event listeners and optionally destroys the WebSocket provider.
   * Must be called on server shutdown to prevent memory / connection leaks.
   */
  disconnect(): void;

  /** True when running without live RPC credentials. */
  readonly isMock: boolean;
}
