// src/engine/hash/canonical.serializer.ts
// ─────────────────────────────────────────────────────────────────────────────
// CanonicalSerializer — Deterministic JSON Serialization
//
// THE MOST CRITICAL COMPONENT of the Hash Engine.
//
// PROBLEM: JSON.stringify(obj) is NOT deterministic across engines or runtimes:
//   - Different runtimes may order properties differently
//   - Numbers may serialize differently (e.g., 1.0 vs 1)
//   - Date objects stringify to ISO strings with varying precision
//   - Nested object key order is unpredictable
//
// SOLUTION: Produce a canonical JSON string where:
//   1. All object keys are SORTED lexicographically at every nesting level
//   2. No whitespace (compact form — no extra spaces or newlines)
//   3. Arrays preserve insertion order (order is semantically significant)
//   4. Dates are normalized to UTC ISO 8601 strings (millisecond precision)
//   5. null, undefined, and NaN are handled consistently
//   6. Numbers avoid floating-point ambiguity where possible
//
// WHY THIS MATTERS:
//   If two nodes have identical data but different property insertion order,
//   naive JSON.stringify would produce DIFFERENT hashes.
//   CanonicalSerializer GUARANTEES identical data → identical hash, always.
// ─────────────────────────────────────────────────────────────────────────────

import { HashableNode } from './interfaces';

/**
 * The exact ordered list of fields that form the canonical hash input.
 * THIS IS THE HASH SCHEMA. Changing field order = breaking change.
 * New fields must be added at the END to preserve backward compatibility.
 */
const CANONICAL_FIELD_ORDER: Array<keyof HashableNode> = [
  'nodeId',
  'stageName',
  'parentNodeIds',
  'childNodeIds',
  'inputHash',
  'outputHash',
  'timestamp',
  'executionDurationMs',
  'agentDid',
  'stepIndex',
  'status',
  'metadata',
] as const;

/**
 * Serialize any value into its canonical string representation.
 * Handles all JSON value types deterministically.
 */
function canonicalizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    // Always UTC, always millisecond precision, always ISO 8601
    return value.toISOString();
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) return null; // NaN, Infinity → null
    // Avoid floating-point ambiguity: store as fixed 10 decimal places for
    // decimals, as integers for whole numbers
    return Number.isInteger(value) ? value : parseFloat(value.toFixed(10));
  }

  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    // Arrays: preserve insertion order, but recursively canonicalize elements
    return value.map((item) => canonicalizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    // Objects: sort keys lexicographically at every depth
    const sortedKeys = Object.keys(value as object).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalizeValue((value as Record<string, unknown>)[key], depth + 1);
    }
    return result;
  }

  return String(value);
}

export class CanonicalSerializer {
  /**
   * Serialize a HashableNode into a deterministic JSON string.
   *
   * The output of this function is what gets passed to SHA-256.
   * Two nodes with identical data will ALWAYS produce identical strings.
   *
   * @example
   * const canon = CanonicalSerializer.serialize(node);
   * // → '{"agentDid":"did:leo:planner:abc","childNodeIds":["uuid-2"],...}'
   */
  static serialize(node: HashableNode): string {
    const canonicalObject: Record<string, unknown> = {};

    // Walk through fields in the EXACT predefined order
    for (const field of CANONICAL_FIELD_ORDER) {
      const value = node[field];
      canonicalObject[field] = canonicalizeValue(value);
    }

    // Compact JSON — no whitespace, no line breaks
    return JSON.stringify(canonicalObject);
  }

  /**
   * Parse a canonical JSON string back into the original object.
   * Useful for debugging and verification logging.
   */
  static deserialize(canonical: string): Partial<HashableNode> {
    return JSON.parse(canonical) as Partial<HashableNode>;
  }

  /**
   * Verify that two nodes would produce the same canonical string.
   * Used to detect if a node has been mutated between computations.
   */
  static wouldMatch(nodeA: HashableNode, nodeB: HashableNode): boolean {
    return CanonicalSerializer.serialize(nodeA) === CanonicalSerializer.serialize(nodeB);
  }

  /**
   * Return the schema version (the ordered field list).
   * Useful for debugging hash mismatches across versions.
   */
  static getSchemaFields(): string[] {
    return [...CANONICAL_FIELD_ORDER];
  }
}
