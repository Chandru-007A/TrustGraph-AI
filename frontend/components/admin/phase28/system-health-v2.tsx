// frontend/components/admin/phase28/system-health-v2.tsx
'use client';

import { useAdminHealth } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, Database, Blocks, CreditCard, BrainCircuit, Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SystemHealthV2() {
  const { data, isLoading, isError } = useAdminHealth();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-32 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load system health.</div>;
  }

  const items = [
    { label: 'Backend API', status: data.backend, icon: <Server className="size-4" /> },
    { label: 'Database', status: data.database, icon: <Database className="size-4" /> },
    { label: 'Arc Blockchain', status: data.arcBlockchain, icon: <Blocks className="size-4" /> },
    { label: 'Circle Gateway', status: data.circleGateway, icon: <CreditCard className="size-4" /> },
    { label: 'x402 Protocol', status: data.x402, icon: <Wallet className="size-4" /> },
    { label: 'OpenAI / Gemini', status: data.openaiGemini, icon: <BrainCircuit className="size-4" /> },
    { label: 'Overall Status', status: data.overallStatus, icon: <Activity className="size-4" /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
      {items.map((item, i) => (
        <div key={i} className={cn(
          "glass-strong rounded-xl border p-4 flex flex-col items-center text-center justify-between gap-3 transition-colors",
          item.status === 'Green' ? "border-green-500/20 bg-green-500/5 hover:border-green-500/40" :
          item.status === 'Yellow' ? "border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40" :
          "border-destructive/20 bg-destructive/5 hover:border-destructive/40"
        )}>
          <div className={cn(
            "size-10 rounded-full flex items-center justify-center",
            item.status === 'Green' ? "text-green-500 bg-green-500/10" :
            item.status === 'Yellow' ? "text-amber-500 bg-amber-500/10" :
            "text-destructive bg-destructive/10"
          )}>
            {item.status === 'Green' ? <CheckCircle2 className="size-5" /> :
             item.status === 'Yellow' ? <AlertTriangle className="size-5" /> : 
             <XCircle className="size-5" />}
          </div>
          
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">{item.label}</span>
            <span className={cn(
              "text-sm font-medium",
              item.status === 'Green' ? "text-green-500" :
              item.status === 'Yellow' ? "text-amber-500" : "text-destructive"
            )}>{item.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Inline Wallet import since I forgot to import it at the top
import { Wallet } from 'lucide-react';
