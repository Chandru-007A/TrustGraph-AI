// frontend/app/dashboard/admin/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Spinner } from '@/components/ui/spinner';
import { Logo } from '@/components/brand/logo';
import { ShieldAlert, Settings } from 'lucide-react';
import Link from 'next/link';

// Phase 28 Components
import { PlatformOverview } from '@/components/admin/phase28/platform-overview';
import { LiveWorkflowActivity } from '@/components/admin/phase28/live-workflow-activity';
import { SystemHealthV2 } from '@/components/admin/phase28/system-health-v2';
import { PerformanceAnalytics } from '@/components/admin/phase28/performance-analytics';
import { FailureMonitor } from '@/components/admin/phase28/failure-monitor';
import { BlockchainMonitorV2 } from '@/components/admin/phase28/blockchain-monitor-v2';
import { PaymentMonitorV2 } from '@/components/admin/phase28/payment-monitor-v2';
import { RecentUserActivity } from '@/components/admin/phase28/recent-user-activity';
import { AuditEvents } from '@/components/admin/phase28/audit-events';
import { SecurityMonitor } from '@/components/admin/phase28/security-monitor';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login?next=/dashboard/admin');
      } else if (user?.role !== 'ADMIN') {
        router.replace('/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading || !user || user.role !== 'ADMIN') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <header className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider">
            <Settings className="size-3" /> System Admin Mode
          </div>
          <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">Exit</Link>
        </div>
      </header>

      <section className="max-w-[100rem] mx-auto px-6 lg:px-12 pt-4 pb-24 space-y-12">
        <div>
          <p className="text-sm text-muted-foreground font-mono mb-2 flex items-center gap-2">
            <ShieldAlert className="size-4" /> Security & Operations Center
          </p>
          <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-2">
            System Monitoring
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Real-time auditing, workflow activity, and blockchain telemetry.
          </p>
        </div>

        {/* Section 1: Platform Overview */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Platform Overview</h2>
          <PlatformOverview />
        </section>

        {/* Section 3: System Health */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Infrastructure Health</h2>
          <SystemHealthV2 />
        </section>

        {/* Section 4: Performance Analytics */}
        <section className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Performance Analytics</h2>
          <PerformanceAnalytics />
        </section>

        {/* Section 2 & 5: Live Activity & Failures */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-medium text-foreground">Live Workflow Activity</h2>
            <LiveWorkflowActivity />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Failure Monitor</h2>
            <FailureMonitor />
          </section>
        </div>

        {/* Section 6 & 7: Blockchain & Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Blockchain Monitor</h2>
            <BlockchainMonitorV2 />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Payment Monitor</h2>
            <PaymentMonitorV2 />
          </section>
        </div>

        {/* Section 8, 9, 10: User Activity, Audit, Security */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Recent User Activity</h2>
            <RecentUserActivity />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Audit Events</h2>
            <AuditEvents />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Security Monitor</h2>
            <SecurityMonitor />
          </section>
        </div>

      </section>
    </main>
  );
}
