// frontend/components/receipts/receipt-timeline.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Activity timeline component for the receipt detail page.
// Renders the ordered list of events returned by the backend.
// ─────────────────────────────────────────────────────────────────────────────

import { CheckCircle2, Circle, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReceiptTimeline as TimelineEvent } from '@/lib/api/receipt.service';

interface ReceiptTimelineProps {
  events: TimelineEvent[];
}

export function ReceiptTimeline({ events }: ReceiptTimelineProps) {
  if (!events.length) return null;

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border/50" />

      <ol className="space-y-5">
        {events.map((evt, i) => (
          <li key={i} className="relative flex items-start gap-3">
            {/* Node */}
            <div
              className={cn(
                'absolute -left-6 flex size-5 shrink-0 items-center justify-center rounded-full border',
                evt.done
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border/60 bg-muted/30 text-muted-foreground/50',
              )}
            >
              {evt.done ? (
                <CheckCircle2 className="size-3" />
              ) : evt.timestamp ? (
                <Clock3 className="size-3" />
              ) : (
                <Circle className="size-3" />
              )}
            </div>

            <div className="pt-0.5">
              <p
                className={cn(
                  'text-sm font-medium',
                  evt.done ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {evt.event}
              </p>
              {evt.timestamp && (
                <p className="mt-0.5 text-[11px] font-mono text-muted-foreground/70">
                  {new Date(evt.timestamp).toLocaleString()}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
