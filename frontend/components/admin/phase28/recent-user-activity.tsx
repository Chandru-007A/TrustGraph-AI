// frontend/components/admin/phase28/recent-user-activity.tsx
'use client';

import { useAdminActivity } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserPlus, LogIn, Link2, Play, CircleDollarSign, ShieldCheck, Activity } from 'lucide-react';

export function RecentUserActivity() {
  const { data, isLoading, isError } = useAdminActivity();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load recent activity.</div>;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'Registration': return <UserPlus className="size-4 text-blue-500" />;
      case 'Login': return <LogIn className="size-4 text-green-500" />;
      case 'Wallet Connection': return <Link2 className="size-4 text-accent" />;
      case 'Research Started': return <Play className="size-4 text-purple-500" />;
      case 'Payment': return <CircleDollarSign className="size-4 text-yellow-500" />;
      case 'Verification': return <ShieldCheck className="size-4 text-primary" />;
      default: return <Activity className="size-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="glass-strong rounded-2xl border border-border/60 flex flex-col h-[400px]">
      <div className="p-4 border-b border-border/40 shrink-0">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Activity className="size-4 text-primary" /> Recent User Activity
        </h3>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {data.map((item) => (
            <div key={`${item.id}-${item.timestamp}`} className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-full bg-card border border-border/40">
                {getIcon(item.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{item.type}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.details}</p>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/60 whitespace-nowrap pt-0.5">
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {data.length === 0 && (
            <div className="text-center text-muted-foreground py-8 text-xs">No recent activity.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
