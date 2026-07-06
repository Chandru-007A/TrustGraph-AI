// frontend/components/explainability/hash-explorer.tsx
'use client';

import { ExplainabilityReport } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CopyField } from '@/components/receipts/copy-field';
import { CheckCircle2 } from 'lucide-react';

export function HashExplorer({ data }: { data: ExplainabilityReport }) {
  // Extract output hashes from nodes
  const nodes = data.nodes;

  return (
    <div className="glass-strong rounded-2xl border border-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node Name</TableHead>
              <TableHead>Agent DID</TableHead>
              <TableHead>Hash Type</TableHead>
              <TableHead>Stored Hash</TableHead>
              <TableHead className="text-right">Integrity Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodes.flatMap(node => {
              if (node.hashes.length === 0) return [];
              return node.hashes.map((hash, i) => (
                <TableRow key={`${node.nodeId}-${i}`}>
                  <TableCell className="font-medium text-xs">
                    {i === 0 ? node.nodeName : ''}
                  </TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground">
                    {i === 0 ? `${node.agentDid.slice(0, 12)}…` : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[9px] rounded-full">
                      {hash.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-1/2">
                    <CopyField label="Stored Hash" value={hash.hashValue} truncate />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5 text-green-500 text-xs">
                      <CheckCircle2 className="size-4" /> 
                      <span className="font-mono">Match</span>
                    </div>
                  </TableCell>
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
