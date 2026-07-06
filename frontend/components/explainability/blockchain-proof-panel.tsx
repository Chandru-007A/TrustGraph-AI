// frontend/components/explainability/blockchain-proof-panel.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { CopyField } from '@/components/receipts/copy-field';
import { Blocks, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export function BlockchainProofPanel({ data }: { data: ExplainabilityReport }) {
  const { blockchain } = data;

  if (!blockchain) {
    return (
      <div className="p-10 text-center rounded-2xl border border-border/40 bg-muted/5 glass-strong">
        <Blocks className="size-8 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No blockchain proof anchored for this session.</p>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
          <Blocks className="size-5 text-accent" />
          Arc L1 Registration
        </h3>
        <Badge variant="outline" className="rounded-full font-mono text-[10px] bg-accent/10 text-accent border-accent/30">
          {blockchain.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <CopyField label="On-Chain Receipt ID" value={blockchain.onChainId || 'Pending'} truncate />
          <CopyField label="Smart Contract" value={blockchain.contract || 'Unknown'} truncate />
        </div>
        <div className="space-y-4">
          <CopyField label="Signature / TxHash" value={blockchain.signature} truncate />
          
          <div className="pt-2">
            <Link 
              href={`/dashboard/receipts/${blockchain.receiptId}`}
              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 text-sm font-medium transition-colors border border-border/60 bg-muted/10 hover:bg-muted/20 rounded-lg text-foreground"
            >
              View in Receipt Explorer <ExternalLink className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
