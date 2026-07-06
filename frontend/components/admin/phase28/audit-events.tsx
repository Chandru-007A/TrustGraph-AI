// frontend/components/admin/phase28/audit-events.tsx
'use client';

import { useAdminActivity } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AuditEvents() {
  const { data, isLoading, isError } = useAdminActivity();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load audit events.</div>;
  }

  // Filter for system/audit type events (Verifications, Payments, Blockchain, Workflows)
  const auditEvents = data.filter(item => 
    item.type !== 'Registration' && 
    item.type !== 'Login' && 
    item.type !== 'Wallet Connection'
  );

  return (
    <div className="glass-strong rounded-2xl border border-border/60 flex flex-col h-[400px]">
      <div className="p-4 border-b border-border/40 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield className="size-4 text-primary" /> System Audit Log
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground uppercase flex items-center gap-1">
          <FileText className="size-3" /> Live
        </span>
      </div>
      
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px before:h-full before:w-px before:bg-border/60">
          <AnimatePresence initial={false}>
            {auditEvents.map((item) => (
              <motion.div
                key={`${item.id}-${item.timestamp}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative flex gap-4"
              >
                <div className="size-5 rounded-full bg-card border border-border/60 flex items-center justify-center shrink-0 z-10 shadow-sm">
                  <div className="size-1.5 rounded-full bg-primary" />
                </div>
                <div className="pt-0.5 pb-2">
                  <p className="text-sm font-medium text-foreground">{item.type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.details}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 mt-2">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {auditEvents.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-8">No audit events generated recently.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
