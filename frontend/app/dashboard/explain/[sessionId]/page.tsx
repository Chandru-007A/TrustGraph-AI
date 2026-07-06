// frontend/app/dashboard/explain/[sessionId]/page.tsx
'use client';

import { useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, CheckCircle2, ShieldCheck, Activity } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useExplainability } from '@/lib/hooks/use-explainability';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import { Spinner } from '@/components/ui/spinner';
import { ExplainHeader } from '@/components/explainability/explain-header';
import { ExplainTimeline } from '@/components/explainability/explain-timeline';
import { ReasoningExplorer } from '@/components/explainability/reasoning-explorer';
import { EvidenceExplorer } from '@/components/explainability/evidence-explorer';
import { HashExplorer } from '@/components/explainability/hash-explorer';
import { MerklePathViewer } from '@/components/explainability/merkle-path-viewer';
import { BlockchainProofPanel } from '@/components/explainability/blockchain-proof-panel';
import { VerificationSummary } from '@/components/explainability/verification-summary';
import { ExportReport } from '@/components/explainability/export-report';

export default function ExplainabilityPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Unwrap params using React.use()
  const { sessionId } = use(params);
  
  const { data, isLoading, isError, refetch } = useExplainability(sessionId);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace(`/login?next=/dashboard/explain/${sessionId}`);
    }
  }, [authLoading, isAuthenticated, router, sessionId]);

  if (authLoading || isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-destructive">Failed to load AI Explainability Report.</p>
        <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
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

      <section className="max-w-5xl mx-auto px-6 lg:px-12 pt-4 pb-24 space-y-16">
        {/* Title */}
        <div>
          <p className="text-sm text-muted-foreground font-mono mb-2 flex items-center gap-2">
            <Search className="size-4" /> Explainability Center
          </p>
          <h1 className="text-3xl lg:text-4xl font-display tracking-tight mb-2">
            AI Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            A comprehensive, cryptographically verified breakdown of how the AI reached its conclusions.
          </p>
        </div>

        {/* 1. Workflow Summary */}
        <section>
          <ExplainHeader data={data} />
        </section>

        {/* 8. Verification Summary (Moved up for high-level trust view) */}
        <section>
          <VerificationSummary data={data} />
        </section>

        {/* 2. Explainability Timeline */}
        <section>
          <h2 className="text-xl font-display text-foreground/90 mb-6 flex items-center gap-2">
            <Activity className="size-5 text-primary" /> Execution Timeline
          </h2>
          <ExplainTimeline data={data} />
        </section>

        {/* 3. Reasoning Explorer */}
        <section>
          <h2 className="text-xl font-display text-foreground/90 mb-6">Reasoning Explorer</h2>
          <ReasoningExplorer data={data} />
        </section>

        {/* 4. Evidence Explorer */}
        <section>
          <h2 className="text-xl font-display text-foreground/90 mb-6">Evidence Utilized</h2>
          <EvidenceExplorer data={data} />
        </section>

        {/* 5. Hash Explorer */}
        <section>
          <h2 className="text-xl font-display text-foreground/90 mb-6">Data Integrity (Hashes)</h2>
          <HashExplorer data={data} />
        </section>

        {/* 6. Merkle Path Viewer */}
        <section>
          <h2 className="text-xl font-display text-foreground/90 mb-6">Merkle Tree Proofs</h2>
          <MerklePathViewer data={data} />
        </section>

        {/* 7. Blockchain Proof */}
        <section>
          <h2 className="text-xl font-display text-foreground/90 mb-6">Blockchain Anchoring</h2>
          <BlockchainProofPanel data={data} />
        </section>

        {/* 9. Export Report */}
        <section>
          <ExportReport data={data} />
        </section>
      </section>
    </main>
  );
}
