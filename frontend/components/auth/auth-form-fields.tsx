// frontend/components/auth/auth-form-fields.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable password-strength display + helper text shown on both forms.
// Kept tiny and pure-presentational so it can be reused for the
// "change password" screen later.
// ─────────────────────────────────────────────────────────────────────────────

import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

const RULES = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  if (!password) return null;
  return (
    <ul className={cn('grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 text-xs', className)}>
      {RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              'flex items-center gap-1.5 transition-colors',
              ok ? 'text-emerald-400' : 'text-muted-foreground/60',
            )}
          >
            <span
              className={cn(
                'inline-block w-1.5 h-1.5 rounded-full transition-colors',
                ok ? 'bg-emerald-400' : 'bg-muted-foreground/40',
              )}
            />
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
