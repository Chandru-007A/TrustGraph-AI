// frontend/components/explainability/merkle-path-viewer.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import { motion } from 'framer-motion';
import { Binary, ChevronDown, CheckCircle2 } from 'lucide-react';
import { CopyField } from '@/components/receipts/copy-field';

export function MerklePathViewer({ data }: { data: ExplainabilityReport }) {
  if (!data.merkle) {
    return (
      <div className="p-10 text-center rounded-2xl border border-border/40 bg-muted/5 glass-strong">
        <Binary className="size-8 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No Merkle tree generated for this session.</p>
      </div>
    );
  }

  const { rootHash, leafCount, proofs } = data.merkle;

  return (
    <div className="glass-strong rounded-2xl border border-border/60 p-6 space-y-8">
      {/* Root Node */}
      <div className="text-center">
        <div className="inline-block p-4 rounded-xl border border-primary/30 bg-primary/5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-primary mb-2 flex items-center justify-center gap-1">
            <CheckCircle2 className="size-3" /> Merkle Root Hash
          </p>
          <p className="text-sm font-mono text-foreground break-all">{rootHash}</p>
        </div>
        <div className="mt-4 flex justify-center text-muted-foreground">
          <ChevronDown className="size-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {proofs.map((proof, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl border border-border/40 bg-card/20 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-mono text-muted-foreground uppercase">Leaf Node Hash</span>
              <span className="text-[10px] font-mono bg-muted/20 px-2 py-0.5 rounded text-muted-foreground">Proof {i + 1} of {leafCount}</span>
            </div>
            
            <CopyField label="Leaf Hash" value={proof.leafHash} truncate />
            
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block">Sibling Path (Bottom to Top)</span>
              
              {/* Note: The proof array might contain objects with hash and position. 
                  We format them safely assuming they are arrays of objects or strings. */}
              {Array.isArray(proof.proof) && proof.proof.map((step: any, stepIdx: number) => (
                <div key={stepIdx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/10 border border-border/20 text-xs font-mono">
                  <span className="text-[10px] uppercase text-muted-foreground bg-card px-1.5 py-0.5 rounded">
                    {step.position || 'SIBLING'}
                  </span>
                  <span className="truncate flex-1 text-muted-foreground">{typeof step === 'string' ? step : step.hash || JSON.stringify(step)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
