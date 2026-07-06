// frontend/components/landing/navigation.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Top navigation — focused redesign.
//
// What this version fixes vs. the old one:
//   • Compresses the row from 9 elements to 5 (logo, 3 primary links, CTA).
//   • Replaces the always-visible email chip + Dashboard link + Sign out
//     button with a single avatar that opens a Radix DropdownMenu. The
//     email is still reachable, just not stealing 180px of horizontal
//     real estate on every page.
//   • Adds a framer-motion "puck" indicator that slides beneath the
//     active section link as the user scrolls (shared `layoutId`).
//   • Drops "Blockchain" and "Developers" from the top-level nav — they
//     are still sections on the page, the user just scrolls to them.
//     Keeping the top row to 3 primary links + CTA is what every
//     modern SaaS does (Linear, Vercel, Stripe).
//   • Mobile hamburger gets a real 44×44 hit area; the slide-in menu
//     has its own close button + a footer with email + sign-out.
//
// Auth branches:
//   • loading         → Spinner in the right slot
//   • unauthenticated → "Sign in" link + primary "Get started" button
//   • authenticated   → Avatar button (Radix DropdownMenu trigger) →
//                       menu: email label, Dashboard, separator, Sign out
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Only 3 primary links in the top row. "Blockchain" and "Developers"
// remain as <section> anchors on the page; users reach them by
// scrolling, not by a second-tier nav.
const primaryLinks = [
  { name: "Platform", href: "#features" },
  { name: "How it works", href: "#how-it-works" },
  { name: "Pricing", href: "#pricing" },
] as const;

// All scroll-spy candidates. We pick the active section from this list
// as the user scrolls; the active link gets the puck indicator.
const sectionIds = primaryLinks.map((l) => l.href.slice(1));

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // ── Scroll: condensed pill past 20px ────────────────────────────
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Scroll-spy: which section is currently in view ──────────────
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visible = new Map<string, number>();

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          // Track each section's current intersection ratio so we can
          // pick the most-visible one instead of just "any intersecting".
          if (entry.isIntersecting) {
            visible.set(id, entry.intersectionRatio);
          } else {
            visible.delete(id);
          }
          // Pick the section with the highest current ratio.
          let bestId: string | null = null;
          let bestRatio = -1;
          visible.forEach((ratio, id) => {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestId = id;
            }
          });
          setActiveSection(bestId);
        },
        {
          // -40% top, -40% bottom shrinks the "active" band so the
          // section feels active when its content is centered, not
          // when its top edge just barely peeks in.
          rootMargin: "-40% 0px -40% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1],
        },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // ── Body scroll lock when the mobile menu is open ───────────────
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileMenuOpen]);

  // ── Escape closes the mobile menu ──────────────────────────────
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMobileMenuOpen]);

  // ── Auth actions ────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await logout();
      toast.success("Signed out");
      setIsMobileMenuOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign out failed";
      toast.error(message);
    }
  };

  // Initials for the avatar fallback (e.g. "chandru.nani007@gmail.com" → "C")
  const avatarInitial = (user?.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <header
      className={cn(
        "fixed z-50 transition-all duration-500",
        isScrolled || isMobileMenuOpen
          ? "top-3 left-3 right-3 md:top-4 md:left-4 md:right-4"
          : "top-0 left-0 right-0",
      )}
    >
      <nav
        className={cn(
          "mx-auto transition-all duration-500",
          isScrolled || isMobileMenuOpen
            ? "glass-strong rounded-2xl shadow-2xl max-w-[1200px]"
            : "bg-transparent max-w-[1400px]",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between transition-all duration-500 px-5 md:px-8",
            isScrolled ? "h-14" : "h-20",
          )}
        >
          {/* ── Logo ─────────────────────────────────────────── */}
          <Link
            href="/"
            className="flex items-center gap-2 group shrink-0"
            aria-label="TrustGraph AI home"
          >
            <Logo />
          </Link>

          {/* ── Primary nav (desktop only) ───────────────────── */}
          <div className="hidden md:flex items-center gap-1 relative">
            {primaryLinks.map((link) => {
              const id = link.href.slice(1);
              const isActive = activeSection === id;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "relative px-3 py-2 text-sm transition-colors duration-200",
                    isActive
                      ? "text-foreground"
                      : "text-foreground/60 hover:text-foreground",
                  )}
                >
                  {link.name}
                  {/* The puck. framer-motion's shared layoutId makes
                      it morph from one link to the next as activeSection
                      changes. */}
                  {isActive ? (
                    <motion.span
                      layoutId="nav-puck"
                      className="absolute inset-x-2 -bottom-0.5 h-0.5 bg-primary"
                      style={{
                        boxShadow:
                          "0 0 12px 0 color-mix(in oklch, var(--primary) 70%, transparent)",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 360,
                        damping: 30,
                      }}
                    />
                  ) : null}
                </a>
              );
            })}
          </div>

          {/* ── Right cluster (desktop) ──────────────────────── */}
          <div className="hidden md:flex items-center gap-2">
            {isLoading ? (
              <div className="flex size-9 items-center justify-center">
                <Spinner className="size-4 text-muted-foreground" />
              </div>
            ) : isAuthenticated ? (
              <UserMenu
                email={user?.email ?? ""}
                initial={avatarInitial}
                onSignOut={handleSignOut}
              />
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-2 text-sm text-foreground/70 hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
                <motion.div
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                >
                  <Button
                    asChild
                    size="sm"
                    className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground group"
                  >
                    <Link href="/register">
                      Get started
                      <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                </motion.div>
              </>
            )}
          </div>

          {/* ── Mobile toggle (44×44 hit area) ──────────────── */}
          <button
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            className="md:hidden flex size-11 items-center justify-center rounded-md text-foreground hover:bg-card/60 transition-colors"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>
      </nav>

      {/* ── Mobile slide-in ──────────────────────────────── */}
      <MobileMenu
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        isAuthenticated={isAuthenticated}
        isLoading={isLoading}
        avatarInitial={avatarInitial}
        onSignOut={handleSignOut}
      />
    </header>
  );
}

// ── User menu (Radix DropdownMenu) ──────────────────────────────────
function UserMenu({
  email,
  initial,
  onSignOut,
}: {
  email: string;
  initial: string;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Open user menu"
        >
          <Avatar className="size-9 border border-border/70 bg-card/60">
            <AvatarFallback className="bg-primary/15 text-primary text-sm font-medium">
              {initial}
            </AvatarFallback>
          </Avatar>
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-64 glass-strong border-border/70"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Signed in as
            </span>
            <span
              className="text-sm font-medium text-foreground/90 truncate"
              title={email}
            >
              {email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/60" />
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="cursor-pointer">
            <LayoutDashboard className="mr-2 size-4" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/60" />
        <DropdownMenuItem
          onSelect={onSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Mobile menu ──────────────────────────────────────────────────────
function MobileMenu({
  open,
  onClose,
  user,
  isAuthenticated,
  isLoading,
  avatarInitial,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  user: { email?: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  avatarInitial: string;
  onSignOut: () => void;
}) {
  return (
    <div
      className={cn(
        "md:hidden fixed inset-0 z-40 transition-all duration-500",
        open
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Backdrop — dim the page underneath, not full blackout */}
      <div
        className="absolute inset-0 bg-background/90 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Panel — slides up from the top */}
      <div
        className={cn(
          "relative h-full flex flex-col px-6 pt-24 pb-8 transition-transform duration-500",
          open ? "translate-y-0" : "-translate-y-4",
        )}
      >
        <div className="flex-1 flex flex-col gap-2">
          {primaryLinks.map((link, i) => (
            <a
              key={link.name}
              href={link.href}
              onClick={onClose}
              className={cn(
                "text-4xl font-display text-foreground hover:text-primary transition-all duration-300 py-3",
                open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4",
              )}
              style={{
                transitionDelay: open ? `${i * 60 + 80}ms` : "0ms",
              }}
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Footer — auth state + CTA */}
        <div
          className={cn(
            "pt-6 border-t border-border/60 space-y-3 transition-all duration-500",
            open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
          )}
          style={{ transitionDelay: open ? "300ms" : "0ms" }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 py-1">
                <Avatar className="size-9 border border-border/70 bg-card/60">
                  <AvatarFallback className="bg-primary/15 text-primary text-sm font-medium">
                    {avatarInitial}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="text-sm text-foreground/80 truncate"
                  title={user?.email}
                >
                  {user?.email}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 rounded-full h-12"
                >
                  <Link href="/dashboard" onClick={onClose}>
                    Dashboard
                  </Link>
                </Button>
                <Button
                  onClick={onSignOut}
                  variant="outline"
                  className="flex-1 rounded-full h-12 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                className="flex-1 rounded-full h-12"
              >
                <Link href="/login" onClick={onClose}>
                  Sign in
                </Link>
              </Button>
              <Button
                asChild
                className="flex-1 rounded-full h-12 bg-primary text-primary-foreground"
              >
                <Link href="/register" onClick={onClose}>
                  Get started
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
