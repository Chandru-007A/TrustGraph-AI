// frontend/components/explainability/evidence-explorer.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Database, Search } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function EvidenceExplorer({ data }: { data: ExplainabilityReport }) {
  // Flatten evidence from all nodes
  const allEvidence = data.nodes.flatMap(n => 
    n.evidence.map(e => ({ ...e, nodeName: n.nodeName, nodeId: n.nodeId }))
  );

  if (allEvidence.length === 0) {
    return (
      <div className="p-10 text-center rounded-2xl border border-border/40 bg-muted/5 glass-strong">
        <Search className="size-8 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">No external evidence utilized in this workflow.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {allEvidence.map((ev, i) => (
        <div key={i} className="glass-strong rounded-xl border border-border/60 p-5 flex flex-col justify-between hover:border-accent/50 transition-colors">
          <div>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                  <Database className="size-4" />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-foreground">{ev.source}</h4>
                  <p className="text-[10px] font-mono text-muted-foreground">Used in: {ev.nodeName}</p>
                </div>
              </div>
              <Badge variant="outline" className={cn(
                'rounded-full text-[10px] font-mono',
                ev.confidence > 0.9 ? 'border-green-500/30 bg-green-500/10 text-green-500' : 'border-amber-500/30 bg-amber-500/10 text-amber-500'
              )}>
                {(ev.confidence * 100).toFixed(1)}% Match
              </Badge>
            </div>
            
            <div className="mb-4 bg-muted/20 p-2.5 rounded-lg border border-border/40">
              <p className="text-xs font-mono text-muted-foreground truncate" title={ev.url}>
                {ev.url}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-muted-foreground">{new Date(ev.timestamp).toLocaleString()}</span>
            <Link 
              href={ev.url} 
              target="_blank" 
              rel="noreferrer"
              className="text-xs flex items-center gap-1 text-primary hover:underline"
            >
              Verify Source <ExternalLink className="size-3" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
