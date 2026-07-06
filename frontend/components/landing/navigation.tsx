// frontend/components/landing/navigation.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Top navigation. Replaced the static "Sign in / Launch" links with an
// auth-aware control:
//   • loading         → spinner
//   • unauthenticated → "Sign in" + "Launch" (→ /register)
//   • authenticated   → user email chip + "Dashboard" + "Sign out"
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";

const navLinks = [
  { name: "How it works", href: "#how-it-works" },
  { name: "Platform", href: "#features" },
  { name: "Blockchain", href: "#security" },
  { name: "Developers", href: "#developers" },
  { name: "Pricing", href: "#pricing" },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${
        isScrolled ? "top-4 left-4 right-4" : "top-0 left-0 right-0"
      }`}
    >
      <nav
        className={`mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "glass-strong rounded-2xl shadow-2xl max-w-[1200px]"
            : "bg-transparent max-w-[1400px]"
        }`}
      >
        <div
          className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          <Link href="/" className="flex items-center gap-2 group">
            <Logo />
          </Link>

          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-sm text-foreground/70 hover:text-foreground transition-colors duration-300 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isLoading ? (
              <Spinner className="size-4 text-muted-foreground" />
            ) : isAuthenticated ? (
              <>
                <span
                  className={`hidden lg:inline text-foreground/60 max-w-[180px] truncate ${
                    isScrolled ? "text-xs" : "text-sm"
                  }`}
                  title={user?.email}
                >
                  {user?.email}
                </span>
                <Link
                  href="/dashboard"
                  className={`text-foreground/70 hover:text-foreground transition-all duration-500 ${isScrolled ? "text-xs" : "text-sm"}`}
                >
                  Dashboard
                </Link>
                <Button
                  asChild
                  size="sm"
                  className={`bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-all duration-500 group ${isScrolled ? "px-4 h-8 text-xs" : "px-6"}`}
                >
                  <Link href="/dashboard">
                    Open app
                    <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <button
                  onClick={handleSignOut}
                  className={`text-muted-foreground hover:text-foreground transition-colors duration-300 inline-flex items-center ${
                    isScrolled ? "text-xs" : "text-sm"
                  }`}
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`text-foreground/70 hover:text-foreground transition-all duration-500 ${isScrolled ? "text-xs" : "text-sm"}`}
                >
                  Sign in
                </Link>
                <Button
                  asChild
                  size="sm"
                  className={`bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-all duration-500 group ${isScrolled ? "px-4 h-8 text-xs" : "px-6"}`}
                >
                  <Link href="/register">
                    Launch platform
                    <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-foreground"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      <div
        className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-500 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ top: 0 }}
      >
        <div className="flex flex-col h-full px-8 pt-28 pb-8">
          <div className="flex-1 flex flex-col justify-center gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-4xl font-display text-foreground hover:text-primary transition-all duration-500 ${
                  isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms" }}
              >
                {link.name}
              </a>
            ))}
          </div>

          <div
            className={`flex gap-4 pt-8 border-t border-border transition-all duration-500 ${
              isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: isMobileMenuOpen ? "300ms" : "0ms" }}
          >
            {isAuthenticated ? (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 rounded-full h-14 text-base"
                >
                  <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                    Dashboard
                  </Link>
                </Button>
                <Button
                  className="flex-1 bg-primary text-primary-foreground rounded-full h-14 text-base"
                  onClick={handleSignOut}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" className="flex-1 rounded-full h-14 text-base">
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>Sign in</Link>
                </Button>
                <Button asChild className="flex-1 bg-primary text-primary-foreground rounded-full h-14 text-base">
                  <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>Launch</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
