// frontend/components/receipts/copy-field.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable copy-to-clipboard field for Phase 23.
// Displays a monospace value with a copy button and optional external link.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyFieldProps {
  label: string;
  value: string | null | undefined;
  /** Truncate long values visually (full value still copied) */
  truncate?: boolean;
  /** Optional URL for the ExternalLink button */
  href?: string | null;
  /** Extra class for the outer wrapper */
  className?: string;
}

export function CopyField({
  label,
  value,
  truncate = false,
  href,
  className,
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!value) return;
    navigator.clipboard
      .writeText(value)
      .then(() => {
        toast.success(`${label} copied`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error('Copy failed'));
  }

  const display = truncate && value && value.length > 20
    ? `${value.slice(0, 10)}…${value.slice(-6)}`
    : value;

  return (
    <div className={cn('group', className)}>
      <label className="block mb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50 transition-colors group-hover:border-border/80">
        <code
          className={cn(
            'flex-1 text-xs font-mono text-foreground/90 select-all',
            truncate && 'truncate',
          )}
          title={value ?? undefined}
        >
          {value ? display : <span className="text-muted-foreground/50">—</span>}
        </code>
        {value && (
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={`Copy ${label}`}
          >
            {copied ? (
              <Check className="size-3 text-primary" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground hover:text-accent transition-colors"
            title="Open in explorer"
          >
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}
