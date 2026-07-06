// frontend/components/auth/auth-shell.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Reusable shell for both /login and /register. The UI is intentionally
// minimal (matches the existing dark/glass aesthetic from the landing page)
// and is fully designed — the integration layer is a separate concern.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}

export function AuthShell({ title, subtitle, children, footer, className }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back to home
        </Link>
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div
            className={cn(
              'glass-strong rounded-2xl shadow-2xl p-8 lg:p-10',
              'border border-border/60',
              className,
            )}
          >
            <header className="mb-8">
              <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-2">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
            </header>
            {children}
          </div>
          <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
        </div>
      </div>
    </main>
  );
}
