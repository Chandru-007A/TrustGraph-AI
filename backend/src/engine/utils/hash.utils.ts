// src/engine/utils/hash.utils.ts
// ─────────────────────────────────────────────────────────────────────────────
// Cryptographic hashing utilities for the workflow engine.
//
// Uses Node.js built-in `crypto` — zero external dependencies.
// These hashes are stored in the Hash table and used to build the Merkle tree.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of any serializable value.
 * The value is deterministically JSON-stringified before hashing,
 * ensuring identical inputs always produce identical hashes.
 */
export const sha256 = (value: unknown): string => {
  const serialized =
    typeof value === 'string' ? value : JSON.stringify(value, Object.keys(value as object).sort());
  return createHash('sha256').update(serialized, 'utf8').digest('hex');
};

/**
 * Build a simple binary Merkle tree from an array of leaf hashes.
 * Returns the Merkle root hash.
 *
 * Algorithm:
 *   1. Start with leaf hashes as the bottom layer.
 *   2. If odd number of nodes, duplicate the last one (standard Bitcoin approach).
 *   3. Hash pairs: SHA256(left + right) to produce the next layer.
 *   4. Repeat until only one hash remains — the root.
 */
export const buildMerkleRoot = (leaves: string[]): { rootHash: string; depth: number } => {
  if (leaves.length === 0) {
    return { rootHash: sha256('empty'), depth: 0 };
  }
  if (leaves.length === 1) {
    return { rootHash: leaves[0], depth: 1 };
  }

  let currentLayer = [...leaves];
  let depth = 1;

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];

    // Pad odd-length layer by duplicating the last element
    if (currentLayer.length % 2 !== 0) {
      currentLayer.push(currentLayer[currentLayer.length - 1]);
    }

    for (let i = 0; i < currentLayer.length; i += 2) {
      const combined = currentLayer[i] + currentLayer[i + 1];
      nextLayer.push(sha256(combined));
    }

    currentLayer = nextLayer;
    depth++;
  }

  return { rootHash: currentLayer[0], depth };
};

/**
 * Generate a mock blockchain transaction ID.
 * Format matches typical hex transaction hashes (64 chars).
 * Replace this with real Arc L1 SDK calls in the blockchain phase.
 */
export const generateMockTxId = (): string => {
  const bytes = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
  );
  return bytes.join('');
};

/**
 * Generate a mock agent DID.
 * Format: did:leo:{agentName}:{randomSuffix}
 */
export const generateAgentDid = (agentName: string): string => {
  const suffix = Math.random().toString(36).substring(2, 10);
  return `did:leo:${agentName.toLowerCase().replace(/\s+/g, '-')}:${suffix}`;
};
