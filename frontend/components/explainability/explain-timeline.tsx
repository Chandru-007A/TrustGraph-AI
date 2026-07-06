// frontend/components/explainability/explain-timeline.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import { motion } from 'framer-motion';
import { Brain, FileText, LayoutDashboard, SearchCode, Settings, ShieldCheck } from 'lucide-react';

export function ExplainTimeline({ data }: { data: ExplainabilityReport }) {
  const nodes = data.nodes;

  const nodeIcon = (name: string) => {
    const l = name.toLowerCase();
    if (l.includes('plan')) return <LayoutDashboard className="size-4" />;
    if (l.includes('retriev')) return <SearchCode className="size-4" />;
    if (l.includes('validat')) return <ShieldCheck className="size-4" />;
    if (l.includes('reason') || l.includes('think')) return <Brain className="size-4" />;
    if (l.includes('format') || l.includes('draft')) return <FileText className="size-4" />;
    return <Settings className="size-4" />;
  };

  return (
    <div className="relative pl-8 space-y-8 before:absolute before:inset-0 before:ml-[1.1875rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/60 before:to-transparent">
      {nodes.map((node, i) => (
        <motion.div
          key={node.nodeId}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
        >
          {/* Icon Marker */}
          <div className="flex items-center justify-center size-10 rounded-full border border-border/60 bg-card glass-strong absolute left-0 md:left-1/2 -translate-x-1/2 shadow-sm text-muted-foreground group-hover:text-primary group-hover:border-primary/50 transition-colors">
            {nodeIcon(node.nodeName)}
          </div>

          {/* Content Card */}
          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border/60 glass-strong">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Step {i + 1}</span>
              <span className="text-[10px] font-mono opacity-60">{node.executionTime}ms</span>
            </div>
            <h4 className="text-sm font-medium text-foreground mb-1">{node.nodeName}</h4>
            <p className="text-xs text-muted-foreground mb-3 truncate">Agent: {node.agentDid}</p>
            
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                <span className="text-muted-foreground block mb-0.5">Hash:</span>
                <span className="truncate block" title={node.hashes[0]?.hashValue || 'N/A'}>
                  {node.hashes[0]?.hashValue ? `${node.hashes[0].hashValue.slice(0, 12)}…` : 'N/A'}
                </span>
              </div>
              <div className="p-1.5 rounded bg-muted/20 border border-border/40">
                <span className="text-muted-foreground block mb-0.5">Confidence:</span>
                <span>{node.confidence ? `${(node.confidence * 100).toFixed(1)}%` : 'N/A'}</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
