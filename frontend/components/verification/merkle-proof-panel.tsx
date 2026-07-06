// frontend/components/verification/merkle-proof-panel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 24 — Merkle Proof display and copy panel.
// Shows leaf hash, sibling steps, computed root vs stored root, result.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { Check, CheckCircle2, Copy, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { StoredMerkleProof, MerkleProofStep } from '@/lib/api';

interface MerkleProofPanelProps {
  proof: StoredMerkleProof;
  storedRoot: string;
  /** Result from verify-proof endpoint — if available */
  computedRoot?: string | null;
  isVerified?: boolean;
  className?: string;
}

function shorten(h: string, head = 10, tail = 8): string {
  if (!h) return '—';
  if (h.length <= head + tail + 3) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

function CopyHash({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      toast.success('Copied');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
    </button>
  );
}

export function MerkleProofPanel({
  proof,
  storedRoot,
  computedRoot,
  isVerified,
  className,
}: MerkleProofPanelProps) {
  const rootsMatch =
    computedRoot !== undefined && computedRoot !== null
      ? computedRoot === storedRoot
      : isVerified;

  function copyProof() {
    const payload = JSON.stringify(
      {
        leafHash: proof.leafHash,
        proof: proof.proof,
        rootHash: storedRoot,
      },
      null,
      2,
    );
    navigator.clipboard.writeText(payload).then(() => toast.success('Proof JSON copied'));
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Leaf hash */}
      <Field label="Leaf Hash" value={proof.leafHash} />

      {/* Sibling steps */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
          Sibling Hashes ({proof.proof.length} steps)
        </p>
        <div className="space-y-1.5">
          {(proof.proof as MerkleProofStep[]).map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/20 border border-border/40"
            >
              <span
                className={cn(
                  'text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border',
                  step.position === 'LEFT'
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-accent/30 bg-accent/5 text-accent',
                )}
              >
                {step.position}
              </span>
              <code className="flex-1 text-[11px] font-mono text-foreground/80 truncate">
                {shorten(step.siblingHash)}
              </code>
              <CopyHash value={step.siblingHash} />
            </div>
          ))}
          {proof.proof.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Single-leaf tree — no siblings required.
            </p>
          )}
        </div>
      </div>

      {/* Root comparison */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Stored Root" value={storedRoot} />
        {computedRoot && <Field label="Computed Root" value={computedRoot} />}
      </div>

      {/* Result */}
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-xl border',
          rootsMatch
            ? 'border-primary/30 bg-primary/5'
            : rootsMatch === false
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-border/40 bg-muted/20',
        )}
      >
        {rootsMatch === true && (
          <CheckCircle2 className="size-5 text-primary shrink-0" />
        )}
        {rootsMatch === false && (
          <XCircle className="size-5 text-destructive shrink-0" />
        )}
        <div>
          <p
            className={cn(
              'text-sm font-semibold',
              rootsMatch === true
                ? 'text-primary'
                : rootsMatch === false
                  ? 'text-destructive'
                  : 'text-muted-foreground',
            )}
          >
            {rootsMatch === true
              ? 'Roots Match — Proof Valid'
              : rootsMatch === false
                ? 'Root Mismatch — Proof Invalid'
                : 'Proof not yet verified'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Node{' '}
            <code className="font-mono">{shorten(proof.nodeId, 6, 4)}</code>{' '}
            — depth {proof.proofDepth}
          </p>
        </div>
      </div>

      {/* Copy proof button */}
      <Button
        variant="outline"
        size="sm"
        className="rounded-full gap-2"
        onClick={copyProof}
      >
        <Copy className="size-3.5" />
        Copy Proof JSON
      </Button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/20 border border-border/40">
        <code className="flex-1 text-[11px] font-mono text-foreground/80 break-all select-all">
          {shorten(value, 14, 10)}
        </code>
        <CopyHash value={value} />
      </div>
    </div>
  );
}
