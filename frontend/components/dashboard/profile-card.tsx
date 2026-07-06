// frontend/components/dashboard/profile-card.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Card that displays the authenticated user's profile fields the spec asks
// for: User Name, Email, Role. Wallet lives in its own card (`<WalletCard />`)
// so this one stays focused on identity.
// ─────────────────────────────────────────────────────────────────────────────

import { Shield, User as UserIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { User } from '@/lib/api/types';
import { cn } from '@/lib/utils';

interface ProfileCardProps {
  user?: User;
  loading?: boolean;
  className?: string;
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          'text-sm text-foreground/90 truncate max-w-[260px]',
          mono && 'font-mono text-xs',
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

export function ProfileCard({ user, loading, className }: ProfileCardProps) {
  if (loading || !user) {
    return (
      <div className={cn('glass-strong rounded-2xl p-6 border border-border/60', className)}>
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  const displayName = user.displayName || user.email.split('@')[0];

  return (
    <div className={cn('glass-strong rounded-2xl p-6 border border-border/60', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
              Profile
            </div>
            <div className="text-base font-medium text-foreground truncate max-w-[220px]">
              {displayName}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/60 bg-card/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Shield className="w-3 h-3" />
          {user.role}
        </div>
      </div>

      <dl className="space-y-2.5">
        <Field label="Name" value={displayName} />
        <Field label="Email" value={user.email} />
      </dl>
    </div>
  );
}
