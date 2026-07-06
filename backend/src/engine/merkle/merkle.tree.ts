// src/engine/merkle/merkle.tree.ts
// ─────────────────────────────────────────────────────────────────────────────
// MerkleTree — Pure Binary Merkle Tree Implementation
//
// This is a self-contained, stateless cryptographic class.
// It depends ONLY on Node.js built-in `crypto` — zero external dependencies.
//
// ALGORITHM:
//   1. Sort leaves lexicographically (deterministic ordering)
//   2. If odd leaves → duplicate last leaf (Bitcoin / Ethereum standard)
//   3. Hash each consecutive pair: SHA-256(left + right)
//   4. Repeat layer-by-layer until a single root hash remains
//
// PROOF GENERATION:
//   For leaf at index i, the proof is the sequence of sibling hashes
//   needed to reconstruct the root. At each layer:
//     - If i is even: sibling is at i+1 (RIGHT sibling)
//     - If i is odd:  sibling is at i-1 (LEFT sibling)
//     - Move up: i = Math.floor(i / 2)
//
// PROOF VERIFICATION:
//   Start with the leaf hash. At each proof step:
//     - If sibling position is LEFT:  hash = SHA-256(sibling + current)
//     - If sibling position is RIGHT: hash = SHA-256(current + sibling)
//   After all steps, compare the result to the expected root hash.
//
// WHY DETERMINISTIC ORDERING:
//   Leaves from different runs of the same workflow must always produce
//   the same tree. Without sorting, insertion-order differences (e.g.,
//   async completion order) would produce different roots for identical data.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto';
import {
  MerkleTreeResult,
  MerkleProof,
  MerkleProofStep,
  MerkleProofVerifyResult,
} from './interfaces';

export class MerkleTree {
  /** SHA-256 of two concatenated hex strings */
  private static hashPair(left: string, right: string): string {
    return createHash('sha256')
      .update(left + right, 'utf8')
      .digest('hex');
  }

  /** SHA-256 of a single string (used for leaf normalization) */
  private static hashLeaf(leaf: string): string {
    // Leaves are already SHA-256 hashes from the Hash Engine.
    // We hash them again to separate the leaf domain from the internal node domain,
    // preventing second-preimage attacks (a known Merkle tree vulnerability).
    return createHash('sha256')
      .update('LEAF:' + leaf, 'utf8')
      .digest('hex');
  }

  /**
   * Build a Merkle tree from an array of leaf hash strings.
   * Returns the full tree (all layers) and the root hash.
   *
   * @param rawLeaves — Unsorted leaf hashes (NODE_HASH values from the Hash table)
   */
  static build(rawLeaves: string[]): MerkleTreeResult {
    const start = Date.now();

    if (rawLeaves.length === 0) {
      const emptyRoot = createHash('sha256').update('EMPTY_TREE', 'utf8').digest('hex');
      return {
        rootHash: emptyRoot,
        leaves: [],
        treeDepth: 0,
        leafCount: 0,
        algorithm: 'SHA-256',
        layers: [[emptyRoot]],
        generationMs: Date.now() - start,
      };
    }

    // Step 1: Sort deterministically (lexicographic order on raw leaf values)
    // This ensures identical data always produces identical trees regardless of
    // the order nodes completed execution.
    const sortedLeaves = [...rawLeaves].sort();

    // Step 2: Domain-separate leaves (second-preimage attack prevention)
    let currentLayer = sortedLeaves.map((leaf) => MerkleTree.hashLeaf(leaf));
    const layers: string[][] = [currentLayer];

    // Step 3: Build layers bottom-up until one hash remains
    while (currentLayer.length > 1) {
      // Pad to even length by duplicating last element (standard approach)
      if (currentLayer.length % 2 !== 0) {
        currentLayer = [...currentLayer, currentLayer[currentLayer.length - 1]];
      }

      const nextLayer: string[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        nextLayer.push(MerkleTree.hashPair(currentLayer[i], currentLayer[i + 1]));
      }

      currentLayer = nextLayer;
      layers.push([...currentLayer]);
    }

    const rootHash = currentLayer[0];
    const treeDepth = layers.length;
    const generationMs = Date.now() - start;

    return {
      rootHash,
      leaves: sortedLeaves,       // Original (unsorted-but-sorted) leaves preserved
      treeDepth,
      leafCount: sortedLeaves.length,
      algorithm: 'SHA-256',
      layers,
      generationMs,
    };
  }

  /**
   * Generate the Merkle proof for a specific leaf.
   *
   * The proof is the minimal set of hashes required for a verifier to
   * independently reconstruct the root without knowing other leaves.
   *
   * @param leafHash — The raw leaf hash (same value passed to build())
   * @param tree     — The tree result from build()
   */
  static generateProof(leafHash: string, tree: MerkleTreeResult): MerkleProof {
    if (tree.leaves.length === 0) {
      throw new Error('Cannot generate proof for an empty tree');
    }

    // Find the index of this leaf in the sorted leaf array
    const leafIndex = tree.leaves.indexOf(leafHash);
    if (leafIndex === -1) {
      throw new Error(`Leaf hash not found in tree: ${leafHash.substring(0, 16)}...`);
    }

    const path: MerkleProofStep[] = [];
    let currentIndex = leafIndex;

    // Walk up the tree (layer[0] = leaf hashes after domain separation)
    // We need to reconstruct the domain-separated leaf layer
    const leafLayer = tree.leaves.map((l) => MerkleTree.hashLeaf(l));

    // Rebuild all layers from the domain-separated leaf layer
    const allLayers: string[][] = [leafLayer];
    let layerBuffer = [...leafLayer];

    while (layerBuffer.length > 1) {
      if (layerBuffer.length % 2 !== 0) {
        layerBuffer = [...layerBuffer, layerBuffer[layerBuffer.length - 1]];
      }
      const next: string[] = [];
      for (let i = 0; i < layerBuffer.length; i += 2) {
        next.push(MerkleTree.hashPair(layerBuffer[i], layerBuffer[i + 1]));
      }
      layerBuffer = next;
      allLayers.push([...layerBuffer]);
    }

    // Collect sibling hashes at each level
    for (let level = 0; level < allLayers.length - 1; level++) {
      const layer = allLayers[level];
      const isRightNode = currentIndex % 2 === 1;

      if (isRightNode) {
        // Current node is on the RIGHT → sibling is on the LEFT
        path.push({
          siblingHash: layer[currentIndex - 1],
          position: 'LEFT',
        });
      } else {
        // Current node is on the LEFT → sibling is on the RIGHT
        // If no right sibling exists (odd layer), use self (same as padding)
        const siblingIndex = currentIndex + 1 < layer.length
          ? currentIndex + 1
          : currentIndex;
        path.push({
          siblingHash: layer[siblingIndex],
          position: 'RIGHT',
        });
      }

      // Move to parent index for next level
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leafHash,
      rootHash: tree.rootHash,
      path,
      treeDepth: tree.treeDepth,
      leafIndex,
    };
  }

  /**
   * Verify that a leaf hash is a member of a Merkle tree with the given root.
   *
   * This is a STATELESS operation — requires no access to the full tree.
   * Any verifier (including a blockchain smart contract) can run this.
   *
   * Algorithm:
   *   1. Domain-separate the leaf: H = SHA-256("LEAF:" + leafHash)
   *   2. For each proof step:
   *      - If sibling is LEFT:  H = SHA-256(sibling + H)
   *      - If sibling is RIGHT: H = SHA-256(H + sibling)
   *   3. Compare final H to rootHash
   *
   * @param leafHash — The raw leaf hash (before domain separation)
   * @param path     — The Merkle proof path (from generateProof)
   * @param rootHash — The expected Merkle root to verify against
   */
  static verifyProof(
    leafHash: string,
    path: MerkleProofStep[],
    rootHash: string,
  ): MerkleProofVerifyResult {
    const verifiedAt = new Date();

    try {
      // Start with the domain-separated leaf hash
      let currentHash = MerkleTree.hashLeaf(leafHash);

      // Walk up the tree using the proof path
      for (const step of path) {
        if (step.position === 'LEFT') {
          // Sibling is on the left: SHA-256(sibling + current)
          currentHash = MerkleTree.hashPair(step.siblingHash, currentHash);
        } else {
          // Sibling is on the right: SHA-256(current + sibling)
          currentHash = MerkleTree.hashPair(currentHash, step.siblingHash);
        }
      }

      const isValid = currentHash === rootHash;

      return {
        leafHash,
        rootHash,
        isValid,
        computedRoot: currentHash,
        verifiedAt,
        reason: isValid
          ? undefined
          : `Computed root ${currentHash.substring(0, 16)}... does not match expected root ${rootHash.substring(0, 16)}...`,
      };
    } catch (err: any) {
      return {
        leafHash,
        rootHash,
        isValid: false,
        computedRoot: '',
        verifiedAt,
        reason: `Proof verification failed: ${err.message}`,
      };
    }
  }
}
