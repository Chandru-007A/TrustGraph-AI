// frontend/app/dashboard/payments/page.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import { Spinner } from '@/components/ui/spinner';
import { PaymentSummary } from '@/components/payments/payment-summary';
import { PaymentAnalyticsCharts } from '@/components/payments/payment-analytics-charts';
import { PaymentHistoryTable } from '@/components/payments/payment-history-table';
import { PurchasedNodes } from '@/components/payments/purchased-nodes';

export default function PaymentCenterPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?next=/dashboard/payments');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      {/* Header */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-6">
        <Link href="/" aria-label="Home"><Logo /></Link>
        <Button
          variant="ghost" size="sm" className="rounded-full gap-1.5"
          onClick={() => router.push('/dashboard')}
        >
          <ArrowLeft className="size-3.5" />
          Dashboard
        </Button>
      </header>

      {/* Body */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pt-4 pb-24 space-y-12">
        {/* Hero */}
        <div>
          <p className="text-sm text-muted-foreground font-mono mb-2 flex items-center gap-2">
            <CreditCard className="size-4" /> Dashboard / Payments
          </p>
          <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-2">
            Payment Center
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Monitor your x402 nanopayments, spending analytics, Circle Gateway transactions, and acquired reasoning nodes in one place.
          </p>
        </div>

        {/* Section 1: Summary */}
        <section>
          <h2 className="text-lg font-medium text-foreground/90 mb-4 font-display">Payment Summary</h2>
          <PaymentSummary />
        </section>

        {/* Section 2: Analytics */}
        <section>
          <h2 className="text-lg font-medium text-foreground/90 mb-4 font-display">Spending Analytics</h2>
          <PaymentAnalyticsCharts />
        </section>

        {/* Section 3: Purchased Nodes */}
        <section>
          <h2 className="text-lg font-medium text-foreground/90 mb-4 font-display">Recent Acquired Assets</h2>
          <PurchasedNodes />
        </section>

        {/* Section 4: History Table */}
        <section>
          <h2 className="text-lg font-medium text-foreground/90 mb-4 font-display">Payment History</h2>
          <PaymentHistoryTable />
        </section>
      </section>
    </main>
  );
}
