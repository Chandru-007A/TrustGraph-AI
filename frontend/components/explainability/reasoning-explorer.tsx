// frontend/components/explainability/reasoning-explorer.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Network, Timer, BrainCircuit } from 'lucide-react';

export function ReasoningExplorer({ data }: { data: ExplainabilityReport }) {
  return (
    <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
      <Accordion type="single" collapsible className="w-full">
        {data.nodes.map((node, i) => (
          <AccordionItem key={node.nodeId} value={node.nodeId} className="border-border/40">
            <AccordionTrigger className="px-6 hover:bg-muted/10">
              <div className="flex items-center gap-4 text-left">
                <Badge variant="outline" className="font-mono text-[10px] rounded-full shrink-0">
                  STEP {i + 1}
                </Badge>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{node.nodeName}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">{node.agentDid}</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6 pt-2 border-t border-border/40 bg-muted/5">
              <div className="space-y-6">
                
                {/* Metrics row */}
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card/40 px-2.5 py-1 rounded-full border border-border/40">
                    <Timer className="size-3.5" />
                    <span className="font-mono">{node.executionTime}ms duration</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card/40 px-2.5 py-1 rounded-full border border-border/40">
                    <BrainCircuit className="size-3.5" />
                    <span className="font-mono">{node.confidence ? (node.confidence * 100).toFixed(1) : 'N/A'}% confidence</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card/40 px-2.5 py-1 rounded-full border border-border/40">
                    <Network className="size-3.5" />
                    <span className="font-mono">{node.parentNodes.length} parents, {node.childNodes.length} children</span>
                  </div>
                </div>

                {/* Prompt Section */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Prompt / Input Data</h4>
                  <div className="p-3 rounded-lg bg-card border border-border/40 text-xs font-mono text-foreground/80 break-all whitespace-pre-wrap">
                    {node.prompt || 'No input prompt data available in registry.'}
                  </div>
                </div>

                {/* Output Section */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">AI Output / Response</h4>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs font-mono text-primary/90 break-all whitespace-pre-wrap">
                    {node.output || 'No output data available in registry.'}
                  </div>
                </div>

              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
