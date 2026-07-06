// frontend/components/admin/system-health.tsx
'use client';

import { useAdminHealth } from '@/lib/hooks/use-admin';
import { Badge } from '@/components/ui/badge';
import { Server, Database, CreditCard, BrainCircuit, Blocks, Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function SystemHealth() {
  const { data, isLoading, isError } = useAdminHealth();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-32 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load system health.</div>;
  }

  const items = [
    { label: 'Backend Status', status: data.backend, icon: <Server className="size-4" /> },
    { label: 'Database Status', status: data.database, icon: <Database className="size-4" /> },
    { label: 'Arc Blockchain', status: data.arcBlockchain, icon: <Blocks className="size-4" /> },
    { label: 'Circle Gateway', status: data.circleGateway, icon: <CreditCard className="size-4" /> },
    { label: 'x402 Service', status: data.x402, icon: <Wallet className="size-4" /> },
    { label: 'OpenAI / Gemini', status: data.openaiGemini, icon: <BrainCircuit className="size-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item, i) => (
        <div key={i} className="glass-strong rounded-xl border border-border/60 p-4 flex flex-col justify-between hover:bg-card/50 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="size-8 rounded-full bg-card flex items-center justify-center text-muted-foreground border border-border/40">
              {item.icon}
            </div>
            <Badge variant="outline" className={`font-mono text-[10px] rounded-full ${
              item.status === 'Green' ? 'text-green-500 border-green-500/30 bg-green-500/10' :
              item.status === 'Yellow' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' :
              'text-destructive border-destructive/30 bg-destructive/10'
            }`}>
              {item.status}
            </Badge>
          </div>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
