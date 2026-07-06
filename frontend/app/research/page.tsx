// frontend/app/research/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// AI Research prompt page.
//
// Wires the research query form to POST /api/v1/workflow/start.
//
// UX:
//   • react-hook-form + zod (mirrors the backend's startWorkflowSchema)
//   • Disabled button + spinner during the request (duplicate-safe)
//   • On success: cache the response in React Query and auto-navigate to
//     /dashboard/{sessionId}. The detail page reads the cached session
//     from useWorkflowSession for an instant render.
//   • On failure: a single, descriptive toast — 401s (token expired) and
//     403s (forbidden) are surfaced with their own copy; 500s and network
//     failures fall through to a generic message.
//   • Auth is enforced by middleware.ts (refresh-cookie present) and by
//     useAuth() at mount time.
//
// No UI redesign — same dark/glass aesthetic as /login and /register.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight, ShieldCheck, Wallet as WalletIcon } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useWallet } from '@/hooks/use-wallet';
import { useStartWorkflow } from '@/lib/hooks/use-dashboard';
import type { StartWorkflowResponse } from '@/lib/api/workflow.types';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

// ── Form schema ─────────────────────────────────────────────────────────
// Backend enforces: query ≥ 3 chars, ≤ 1000 chars. We mirror it exactly.
const researchSchema = z.object({
  query: z
    .string()
    .trim()
    .min(3, 'Query must be at least 3 characters')
    .max(1000, 'Query must be at most 1000 characters'),
});

type ResearchFormValues = z.infer<typeof researchSchema>;

// ── Human-friendly status derivation ────────────────────────────────────
// The backend returns the workflow's terminal status, but doesn't expose
// a dedicated `status` field — we infer it from `success` and
// `paymentStatus`. This mirrors the dashboard's row status logic so the
// two views always agree.
function deriveStatus(payload: StartWorkflowResponse | undefined): string {
  if (!payload) return 'Unknown';
  if (payload.success) {
    return String(payload.paymentStatus ?? 'COMPLETED').toUpperCase();
  }
  return 'FAILED';
}

// ── Error categoriser ───────────────────────────────────────────────────
// The axios client in lib/api/client.ts auto-handles 401 by trying a single
// refresh + retry. By the time the error reaches this hook, a 401 means
// the refresh also failed and the user has been logged out. We still
// distinguish the cases so the toast copy is accurate.
interface ErrorShape {
  response?: { status?: number; data?: { message?: string } };
  code?: string;
  message?: string;
}

function classifyError(err: unknown): { title: string; description: string } {
  const e = err as ErrorShape;
  const status = e?.response?.status;
  const serverMessage = e?.response?.data?.message;
  const fallback = e?.message || 'An unexpected error occurred';

  if (status === 401) {
    return {
      title: 'Session expired',
      description: 'Please sign in again to start a workflow.',
    };
  }
  if (status === 403) {
    return {
      title: 'Not allowed',
      description: serverMessage || 'Your account is not permitted to start workflows.',
    };
  }
  if (status === 500 || (typeof status === 'number' && status >= 500)) {
    return {
      title: 'Server error',
      description: serverMessage || 'The workflow engine returned an error. Please try again.',
    };
  }
  if (e?.code === 'ERR_NETWORK' || !e?.response) {
    return {
      title: 'Network error',
      description: 'Could not reach the workflow engine. Check your connection and try again.',
    };
  }
  return { title: 'Could not start workflow', description: serverMessage || fallback };
}

export default function ResearchPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const wallet = useWallet();
  const startWorkflow = useStartWorkflow();

  // Local "submitted" lock — react-hook-form gives us formState.isSubmitting,
  // but we also keep our own state so the disabled UI is identical to the
  // mutation's pending state. A ref guards against double-submits even if
  // both signals race.
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const submittedRef = useRef(false);

  // Success state — shows the IDs briefly so the user gets visual
  // confirmation, then we auto-navigate to the detail page. The brief
  // pause is also what gives `setQueryData` (called inside the mutation's
  // onSuccess) time to land before the detail page subscribes to it.
  const [successPayload, setSuccessPayload] =
    useState<StartWorkflowResponse | null>(null);
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending navigation if the component unmounts (user hits
  // back, navigates away, etc.) — prevents setState on an unmounted tree.
  useEffect(() => {
    return () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current);
    };
  }, []);

  // ── Auth bootstrap guard ────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login?next=/research');
    }
  }, [authLoading, isAuthenticated, router]);

  // ── Form setup ──────────────────────────────────────────────────────
  const form = useForm<ResearchFormValues>({
    resolver: zodResolver(researchSchema),
    defaultValues: { query: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    // Re-entrancy guard. The button is also disabled, but in React a
    // double-click on the same frame can still fire two onSubmit handlers
    // before the disabled state lands. The ref makes the check synchronous.
    if (submittedRef.current) return;
    submittedRef.current = true;
    setLocalSubmitting(true);

    try {
      const result: StartWorkflowResponse = await startWorkflow.mutateAsync({
        query: values.query,
      });

      if (!result?.sessionId) {
        throw new Error('Server response did not include a sessionId.');
      }

      // Surface the success state so the user sees the IDs before we
      // navigate. The detail page reads the same session out of React
      // Query's cache (useStartWorkflow pre-seeded it via setQueryData),
      // so the first paint on the detail page is instant.
      setSuccessPayload(result);
      navigateTimerRef.current = setTimeout(() => {
        router.push(`/dashboard/${result.sessionId}`);
      }, 1200);
    } catch (err) {
      // Roll back the re-entrancy guard so the user can retry.
      submittedRef.current = false;
      const { title, description } = classifyError(err);
      toast.error(title, { description });
    } finally {
      setLocalSubmitting(false);
    }
  });

  // Combine RHF's submit state with the mutation's pending state so the
  // button stays disabled through the whole request → navigation window.
  const isSubmitting =
    localSubmitting || form.formState.isSubmitting || startWorkflow.isPending;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  // ── Success view ────────────────────────────────────────────────────
  // Brief confirmation panel showing the workflow + session IDs and the
  // inferred status, with a spinner indicating the auto-navigate is
  // pending. Same glass-card aesthetic as the form below.
  if (successPayload?.sessionId) {
    const status = deriveStatus(successPayload);
    const sessionId = successPayload.sessionId;
    return (
      <AuthShell
        title="Workflow started"
        subtitle="Anchoring your DAG on Arc. Redirecting to the verification view…"
        footer={
          <>
            <Link
              href={`/dashboard/${sessionId}`}
              className="text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              Skip to session
            </Link>
            {' · '}
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to dashboard
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <dl className="grid gap-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-4 py-3">
              <dt className="text-muted-foreground font-mono text-xs uppercase tracking-wide">
                Workflow ID
              </dt>
              <dd className="font-mono text-xs truncate ml-3" title={sessionId}>
                {sessionId}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-4 py-3">
              <dt className="text-muted-foreground font-mono text-xs uppercase tracking-wide">
                Session ID
              </dt>
              <dd className="font-mono text-xs truncate ml-3" title={sessionId}>
                {sessionId}
              </dd>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-4 py-3">
              <dt className="text-muted-foreground font-mono text-xs uppercase tracking-wide">
                Current status
              </dt>
              <dd className="text-xs font-medium">
                <span
                  className={
                    status === 'COMPLETED'
                      ? 'text-emerald-400'
                      : status === 'FAILED'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  }
                >
                  {status}
                </span>
              </dd>
            </div>
          </dl>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
            <Spinner className="size-3.5" />
            Redirecting…
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Start a research workflow"
      subtitle="Describe what you want TrustGraph to research. We'll build a verified DAG, anchor it on Arc, and unlock reasoning nodes as you pay."
      footer={
        <>
          Want to see past workflows?{' '}
          <Link
            href="/dashboard"
            className="text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Open the dashboard
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="query">Research query</Label>
          <Textarea
            id="query"
            rows={6}
            placeholder="e.g. Compare optimistic vs. ZK rollups for settlement guarantees on consumer-grade hardware."
            disabled={isSubmitting}
            aria-invalid={!!form.formState.errors.query}
            {...form.register('query')}
          />
          {form.formState.errors.query && (
            <p className="text-xs text-destructive" role="alert">
              {form.formState.errors.query.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Every node is hashed and Merkle-anchored before payment.
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full rounded-full h-12"
          disabled={isSubmitting || !wallet.isConnected}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner className="mr-2" />
              Starting workflow…
            </>
          ) : (
            <>
              Start workflow
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        {!wallet.isConnected && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-amber-200/90">
              <WalletIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Connect your wallet before starting a workflow.</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
              onClick={wallet.openConnectModal}
            >
              Connect Wallet
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          By starting a workflow you agree to the per-node USDC micropayments
          that unlock each verified reasoning step.
        </p>
      </form>
    </AuthShell>
  );
}
