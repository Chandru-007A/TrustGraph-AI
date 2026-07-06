// frontend/components/admin/phase28/security-monitor.tsx
'use client';

import { useAdminSecurity } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, AlertTriangle, Fingerprint, Hash, ShieldX, Link2Off, Activity } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function SecurityMonitor() {
  const { data, isLoading, isError } = useAdminSecurity();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load security monitor.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 flex flex-col h-[400px]">
      <div className="p-4 border-b border-border/40 shrink-0">
        <h3 className="text-sm font-medium flex items-center gap-2 text-destructive">
          <ShieldAlert className="size-4" /> Security & Threat Monitor
        </h3>
      </div>
      
      <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3 border-b border-border/40 bg-muted/5 shrink-0">
        <div className="p-3 rounded-xl bg-card border border-border/40 flex flex-col">
          <span className="text-[9px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1"><AlertTriangle className="size-3 text-amber-500" /> Failed Logins</span>
          <span className="text-lg font-mono">{data.failedLogins}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/40 flex flex-col">
          <span className="text-[9px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1"><Fingerprint className="size-3 text-destructive" /> Invalid Sigs</span>
          <span className="text-lg font-mono">{data.invalidSignatures}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/40 flex flex-col">
          <span className="text-[9px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1"><Hash className="size-3 text-amber-500" /> Hash Mismatch</span>
          <span className="text-lg font-mono">{data.hashMismatches}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/40 flex flex-col">
          <span className="text-[9px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1"><ShieldX className="size-3 text-destructive" /> Verification Fail</span>
          <span className="text-lg font-mono">{data.verificationFailures}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/40 flex flex-col">
          <span className="text-[9px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1"><Link2Off className="size-3 text-amber-500" /> Disconnects</span>
          <span className="text-lg font-mono">{data.walletDisconnects}</span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border/40 flex flex-col">
          <span className="text-[9px] font-mono uppercase text-muted-foreground mb-1 flex items-center gap-1"><Activity className="size-3 text-destructive" /> Suspicious</span>
          <span className="text-lg font-mono">{data.suspiciousActivity}</span>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          <h4 className="text-[10px] font-mono uppercase text-muted-foreground mb-2">Recent Security Events</h4>
          {data.items.map((item) => (
            <div key={item.id} className="p-3 rounded-lg border border-destructive/20 bg-destructive/5 flex items-start gap-3">
              <ShieldAlert className="size-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-destructive">{item.type}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.details}</p>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/60 whitespace-nowrap">
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {data.items.length === 0 && (
             <div className="text-center text-muted-foreground text-xs py-4">No critical security events detected.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
