// frontend/app/dashboard/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// User-facing dashboard.
//
// Composition (no UI redesign — same glass / monospace / muted-foreground
// aesthetic as the rest of the app):
//   ┌─ Top bar (logo, user email, sign out)
//   ├─ Hero (welcome + display name)
//   ├─ Stats grid  (6× <StatCard>)
//   ├─ Two-column section
//   │   ├─ <ProfileCard>     — name, email, wallet, role
//   │   └─ <BlockchainStatusCard> — connected / mock / disconnected + anchored
//   └─ <WorkflowList>        — search, filter, table, pagination
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  CircleDollarSign,
  CreditCard,
  Hash,
  ListChecks,
  LogOut,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  useProfile,
  useWorkflowStats,
} from '@/lib/hooks/use-dashboard';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import { Spinner } from '@/components/ui/spinner';
import { BlockchainStatusCard } from '@/components/dashboard/blockchain-status-card';
import { ProfileCard } from '@/components/dashboard/profile-card';
import { StatCard } from '@/components/dashboard/stat-card';
import { WalletCard } from '@/components/dashboard/wallet-card';
import { WorkflowList } from '@/components/dashboard/workflow-list';
import { PaymentHistory } from '@/components/payments/payment-history';

export default function DashboardIndexPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // ── Auth bootstrap guard ─────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?next=/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  // ── Data hooks (run in parallel — all share the QueryClient cache) ─
  const profile = useProfile();
  const stats = useWorkflowStats();

  const handleSignOut = async () => {
    try {
      await logout();
      toast.success('Signed out', { description: 'See you next time.' });
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sign out';
      toast.error('Sign out failed', { description: message });
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    );
  }

  const user = profile.data;
  const welcome = user?.displayName || user?.email?.split('@')[0] || '';

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-card/40 text-sm">
            <span className="text-foreground/80">{user?.email ?? '—'}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={handleSignOut}
            disabled={authLoading}
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign out
          </Button>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-6 pb-24">
        {/* Hero */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <p className="text-sm text-muted-foreground font-mono mb-3">Dashboard</p>
            <h1 className="text-4xl lg:text-5xl font-display tracking-tight leading-[1.05]">
              {welcome ? `Welcome back, ${welcome}` : 'Welcome back'}
            </h1>
            <p className="text-base text-muted-foreground mt-3 max-w-xl">
              A live view of your verified-reasoning workflows, payments, and
              anchored receipts.
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="rounded-full h-12 px-6 self-start sm:self-auto"
          >
            <Link href="/research">
              Start a new workflow
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-10">
          <StatCard
            label="Total workflows"
            value={stats.data?.totalWorkflows ?? 0}
            loading={stats.isPending}
            icon={<Hash className="w-4 h-4" />}
            hint={
              stats.data
                ? `${stats.data.runningWorkflows} running · ${stats.data.completedWorkflows} completed`
                : undefined
            }
          />
          <StatCard
            label="Verified receipts"
            value={stats.data?.verifiedReceipts ?? 0}
            loading={stats.isPending}
            icon={<ShieldCheck className="w-4 h-4" />}
            hint={
              stats.data
                ? `${stats.data.blockchainAnchored} anchored to Arc L1`
                : undefined
            }
          />
          <StatCard
            label="Purchased nodes"
            value={stats.data?.purchasedNodes ?? 0}
            loading={stats.isPending}
            icon={<CircleDollarSign className="w-4 h-4" />}
            hint={
              stats.data
                ? `${stats.data.totalNodes} total across all sessions`
                : undefined
            }
          />
          <StatCard
            label="Pending"
            value={stats.data?.pendingWorkflows ?? 0}
            loading={stats.isPending}
            icon={<ListChecks className="w-4 h-4" />}
          />
          <StatCard
            label="Failed"
            value={stats.data?.failedWorkflows ?? 0}
            loading={stats.isPending}
          />
          <StatCard
            label="Completed"
            value={stats.data?.completedWorkflows ?? 0}
            loading={stats.isPending}
            icon={<Wallet className="w-4 h-4" />}
          />
        </div>

        {/* Profile + wallet + blockchain */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-10">
          <ProfileCard user={user} loading={profile.isPending} />
          <WalletCard />
          <BlockchainStatusCard
            status={stats.data?.blockchainStatus}
            anchoredCount={stats.data?.blockchainAnchored}
            loading={stats.isPending}
          />
        </div>

        {/* Phase 22: x402 payment history */}
        <div className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <Link
              href="/dashboard/payments"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-accent transition-colors"
            >
              <CreditCard className="size-3" />
              Payment Center
            </Link>
            <Link
              href="/dashboard/verification"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-accent transition-colors"
            >
              <ShieldCheck className="size-3" />
              Verification Center
            </Link>
            <Link
              href="/dashboard/receipts"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-accent transition-colors"
            >
              View Receipt Explorer
              <ArrowRight className="size-3" />
            </Link>
          </div>
          <PaymentHistory />
        </div>


        {/* Workflow list */}
        <WorkflowList />
      </section>
    </main>
  );
}
