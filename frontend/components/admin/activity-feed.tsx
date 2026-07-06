// frontend/components/admin/activity-feed.tsx
'use client';

import { useAdminActivity } from '@/lib/hooks/use-admin';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function ActivityFeed() {
  const { data, isLoading, isError } = useAdminActivity();

  if (isLoading || !data) {
    return <Skeleton className="w-full h-80 rounded-2xl" />;
  }

  if (isError) {
    return <div className="text-destructive text-sm p-4">Failed to load activity feed.</div>;
  }

  return (
    <div className="glass-strong rounded-2xl border border-border/60 p-6 flex flex-col h-96">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <Activity className="size-4 text-primary" /> Live Activity Feed
      </h3>

      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {data.map((item) => (
              <motion.div
                key={`${item.id}-${item.timestamp}`}
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="flex gap-3"
              >
                <div className="mt-1 flex flex-col items-center">
                  <Circle className="size-2 fill-primary text-primary" />
                  <div className="w-px h-full bg-border/40 mt-1" />
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-foreground/90">{item.type}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{item.details}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
