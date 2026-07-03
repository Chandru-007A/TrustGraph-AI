import { cn } from "@/lib/utils";

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-flex h-8 w-8 items-center justify-center">
        <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="tg-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--primary)" />
              <stop offset="1" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          {/* Merkle-style node graph */}
          <path d="M16 5 L7 12 M16 5 L25 12 M7 12 L7 22 M25 12 L25 22 M7 22 L16 27 M25 22 L16 27"
            stroke="url(#tg-logo)" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
          <circle cx="16" cy="5" r="3" fill="url(#tg-logo)" />
          <circle cx="7" cy="12" r="2.4" fill="url(#tg-logo)" opacity="0.85" />
          <circle cx="25" cy="12" r="2.4" fill="url(#tg-logo)" opacity="0.85" />
          <circle cx="7" cy="22" r="2.4" fill="url(#tg-logo)" opacity="0.7" />
          <circle cx="25" cy="22" r="2.4" fill="url(#tg-logo)" opacity="0.7" />
          <circle cx="16" cy="27" r="3" fill="url(#tg-logo)" />
        </svg>
      </span>
      {showText && (
        <span className="font-display text-xl tracking-tight text-foreground">
          TrustGraph<span className="text-primary"> AI</span>
        </span>
      )}
    </span>
  );
}
