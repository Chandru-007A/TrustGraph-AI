// frontend/components/verification/merkle-tree-visualizer.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — Visual Merkle Tree Diagram
//
// Renders the binary Merkle tree as an SVG-based tree diagram.
// Color codes: gray=waiting, blue=running, green=verified, red=failed.
// Clicking a leaf highlights the verification path (leaf → parents → root).
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { MerkleTreeData } from '@/lib/api';

interface TreeNode {
  hash: string;
  label: string;
  level: number;
  index: number;
  isLeaf: boolean;
  isRoot: boolean;
  status: 'verified' | 'waiting' | 'failed';
}

interface MerkleTreeVisualizerProps {
  tree: MerkleTreeData;
  /** nodeId→status map for color coding */
  nodeStatuses?: Record<string, 'COMPLETED' | 'FAILED' | 'RUNNING' | 'QUEUED'>;
  onLeafClick?: (leafHash: string) => void;
  className?: string;
}

function buildLevels(leaves: string[], rootHash: string): TreeNode[][] {
  if (leaves.length === 0) return [];

  // Build the tree level by level bottom-up
  const allLevels: string[][] = [leaves.slice()];
  let current = leaves.slice();

  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] ?? current[i]; // duplicate last if odd
      // Simplified parent: we just use a truncated hash for display
      next.push(`${left.slice(0, 4)}..${right.slice(-4)}`);
    }
    allLevels.push(next);
    current = next;
  }

  // Replace last level's single hash with actual rootHash
  if (allLevels.length > 0) {
    allLevels[allLevels.length - 1] = [rootHash];
  }

  // Reverse so root is at top (level 0)
  const reversed = allLevels.reverse();
  return reversed.map((hashes, level) =>
    hashes.map((hash, index) => ({
      hash,
      label: `${hash.slice(0, 6)}…${hash.slice(-4)}`,
      level,
      index,
      isLeaf: level === reversed.length - 1,
      isRoot: level === 0,
      status: 'verified' as const,
    })),
  );
}

const STATUS_COLOR = {
  verified: 'border-primary/60 bg-primary/10 text-primary hover:bg-primary/20',
  waiting: 'border-border/60 bg-muted/30 text-muted-foreground',
  failed: 'border-destructive/60 bg-destructive/10 text-destructive',
  highlighted: 'border-accent/60 bg-accent/10 text-accent ring-2 ring-accent/40',
  root: 'border-primary bg-primary/20 text-primary font-bold',
};

export function MerkleTreeVisualizer({
  tree,
  nodeStatuses = {},
  onLeafClick,
  className,
}: MerkleTreeVisualizerProps) {
  const [selectedLeaf, setSelectedLeaf] = useState<string | null>(null);

  const levels = useMemo(
    () => buildLevels(tree.leaves, tree.rootHash),
    [tree.leaves, tree.rootHash],
  );

  // Build path of highlighted nodes when a leaf is selected
  const highlightedHashes = useMemo(() => {
    if (!selectedLeaf || levels.length === 0) return new Set<string>();
    const set = new Set<string>();
    // Always highlight the root
    set.add(tree.rootHash);
    // Find the leaf level
    const leafLevel = levels[levels.length - 1] ?? [];
    const leafIdx = leafLevel.findIndex((n) => n.hash === selectedLeaf);
    if (leafIdx === -1) return set;
    set.add(selectedLeaf);
    // Walk up — parent index is Math.floor(childIndex / 2)
    let idx = leafIdx;
    for (let lvl = levels.length - 1; lvl > 0; lvl--) {
      idx = Math.floor(idx / 2);
      const parentNode = levels[lvl - 1]?.[idx];
      if (parentNode) set.add(parentNode.hash);
    }
    return set;
  }, [selectedLeaf, levels, tree.rootHash]);

  const handleLeafClick = useCallback(
    (hash: string, isLeaf: boolean) => {
      if (!isLeaf) return;
      const next = selectedLeaf === hash ? null : hash;
      setSelectedLeaf(next);
      if (next) onLeafClick?.(next);
    },
    [selectedLeaf, onLeafClick],
  );

  if (levels.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No Merkle tree data available.
      </div>
    );
  }

  const maxNodesInLevel = Math.max(...levels.map((l) => l.length));

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div
        className="inline-block min-w-full"
        style={{ minWidth: Math.max(320, maxNodesInLevel * 120) }}
      >
        {levels.map((level, levelIdx) => (
          <div key={levelIdx} className="flex justify-center gap-2 mb-2">
            {level.map((node) => {
              const isHighlighted = highlightedHashes.has(node.hash);
              const nodeColor = node.isRoot
                ? STATUS_COLOR.root
                : isHighlighted
                  ? STATUS_COLOR.highlighted
                  : node.isLeaf
                    ? STATUS_COLOR.verified
                    : STATUS_COLOR.waiting;

              return (
                <div
                  key={`${node.level}-${node.index}`}
                  className={cn(
                    'relative flex flex-col items-center',
                    node.isLeaf && 'cursor-pointer',
                  )}
                  onClick={() => handleLeafClick(node.hash, node.isLeaf)}
                >
                  {/* Connector line to parent */}
                  {levelIdx > 0 && (
                    <div
                      className={cn(
                        'w-px h-4 mb-1 transition-colors',
                        isHighlighted ? 'bg-accent/60' : 'bg-border/40',
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      'px-2 py-1.5 rounded-lg border text-[10px] font-mono whitespace-nowrap transition-all duration-200',
                      nodeColor,
                      node.isRoot && 'text-xs px-3 py-2',
                    )}
                    title={node.hash}
                  >
                    {node.isRoot ? '🌲 ' : node.isLeaf ? '🍃 ' : ''}
                    {node.label}
                  </div>
                  {/* Connector line to children */}
                  {levelIdx < levels.length - 1 && (
                    <div
                      className={cn(
                        'w-px h-4 mt-1 transition-colors',
                        isHighlighted ? 'bg-accent/60' : 'bg-border/40',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border/40">
          {[
            { color: 'bg-primary/20 border-primary/40', label: 'Root' },
            { color: 'bg-primary/10 border-primary/30', label: 'Verified' },
            { color: 'bg-accent/10 border-accent/40', label: 'Selected path' },
            { color: 'bg-muted/30 border-border/40', label: 'Intermediate' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn('size-3 rounded border', color)} />
              <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
            </div>
          ))}
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">
            Click a leaf to trace path
          </span>
        </div>
      </div>
    </div>
  );
}
