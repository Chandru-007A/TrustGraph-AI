// frontend/components/explainability/explain-header.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { CopyField } from '@/components/receipts/copy-field';
import { cn } from '@/lib/utils';
import { Activity, Clock, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export function ExplainHeader({ data }: { data: ExplainabilityReport }) {
  const { session, workflow, merkle, blockchain } = data;

  return (
    <div className="glass-strong rounded-2xl border border-border/60 p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-medium text-foreground">Workflow Summary</h2>
          <p className="text-sm text-muted-foreground">Session ID: <span className="font-mono text-xs">{session.id}</span></p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className={cn('rounded-full font-mono text-xs', session.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-primary/10 text-primary border-primary/30')}>
            {session.status}
          </Badge>
          {blockchain?.status === 'REGISTERED' && (
            <Badge variant="outline" className="rounded-full font-mono text-xs bg-accent/10 text-accent border-accent/30">
              Anchored
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/40 bg-card/20">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <Activity className="size-3" /> Nodes Executed
          </p>
          <p className="text-lg font-mono">{workflow.completedCount} / {workflow.nodeCount}</p>
        </div>
        <div className="p-4 rounded-xl border border-border/40 bg-card/20">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="size-3" /> Execution Time
          </p>
          <p className="text-lg font-mono">{(workflow.executionTimeMs / 1000).toFixed(2)}s</p>
        </div>
        <div className="p-4 rounded-xl border border-border/40 bg-card/20">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <ShieldCheck className="size-3" /> Merkle Verification
          </p>
          <div className="flex items-center gap-2">
            {merkle ? <CheckCircle2 className="size-4 text-green-500" /> : <XCircle className="size-4 text-destructive" />}
            <span className="text-sm">{merkle ? 'Verified' : 'Unverified'}</span>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border/40 bg-card/20">
          <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <Activity className="size-3" /> Total Cost
          </p>
          <p className="text-lg font-mono">{session.totalCost} USDC</p>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-border/40">
        <CopyField label="Merkle Root" value={merkle?.rootHash || 'N/A'} />
        <CopyField label="Blockchain Receipt ID" value={blockchain?.receiptId || 'N/A'} />
      </div>
    </div>
  );
}
