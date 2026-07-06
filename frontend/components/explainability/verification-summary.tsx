// frontend/components/explainability/verification-summary.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Shield, Blocks, Binary, Hash } from 'lucide-react';

export function VerificationSummary({ data }: { data: ExplainabilityReport }) {
  const { merkle, blockchain, verification } = data;

  const checks = [
    {
      label: 'Hash Integrity',
      verified: data.nodes.every(n => n.hashes.length > 0),
      icon: <Hash className="size-5" />
    },
    {
      label: 'Merkle Tree Verified',
      verified: !!merkle?.rootHash,
      icon: <Binary className="size-5" />
    },
    {
      label: 'Blockchain Anchored',
      verified: !!blockchain?.receiptId,
      icon: <Blocks className="size-5" />
    },
    {
      label: 'Cryptographic Audit',
      verified: verification?.isValid ?? false,
      icon: <Shield className="size-5" />
    }
  ];

  const allPassed = checks.every(c => c.verified);

  return (
    <div className={cn(
      'rounded-2xl border p-8 text-center transition-colors',
      allPassed 
        ? 'border-green-500/30 bg-green-500/5' 
        : 'border-destructive/30 bg-destructive/5'
    )}>
      <div className="mb-6 inline-flex p-4 rounded-full bg-card shadow-sm border border-border/40">
        {allPassed ? (
          <CheckCircle2 className="size-12 text-green-500" />
        ) : (
          <XCircle className="size-12 text-destructive" />
        )}
      </div>
      
      <h3 className={cn(
        'text-2xl font-display mb-2',
        allPassed ? 'text-green-500' : 'text-destructive'
      )}>
        {allPassed ? 'AI Output is Trusted & Verified' : 'Verification Failed or Incomplete'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-8">
        {allPassed 
          ? 'Every stage of this workflow has been cryptographically proven and anchored to the Arc blockchain. The AI outputs are authentic and untampered.'
          : 'Some cryptographic proofs are missing or failed validation. The integrity of this workflow cannot be fully guaranteed.'}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
        {checks.map((check, i) => (
          <div key={i} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border/40">
            <div className={cn(
              'p-2 rounded-lg',
              check.verified ? 'bg-green-500/10 text-green-500' : 'bg-muted/20 text-muted-foreground'
            )}>
              {check.icon}
            </div>
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground text-center">
              {check.label}
            </span>
            {check.verified ? (
              <CheckCircle2 className="size-4 text-green-500 mt-1" />
            ) : (
               <XCircle className="size-4 text-muted-foreground mt-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
