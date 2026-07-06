// frontend/app/login/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Login screen. Connects to POST /api/v1/auth/login.
// UX:
//   • react-hook-form + zod (client-side validation mirroring backend rules)
//   • Sonner toast for success / failure
//   • On success → push to /dashboard
//
// Note: useSearchParams() in Next 16 must be wrapped in a <Suspense> boundary
// at the page level to support static prerendering. We split the form out
// into <LoginForm /> and wrap it.
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const next = searchParams.get('next') || '/dashboard';
      router.replace(next);
    }
  }, [authLoading, isAuthenticated, router, searchParams]);

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      await login(values);
      toast.success('Welcome back', {
        description: 'You are now signed in.',
      });
      const next = searchParams.get('next') || '/dashboard';
      router.push(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast.error('Sign in failed', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          disabled={isSubmitting}
          aria-invalid={!!form.formState.errors.email}
          {...form.register('email')}
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive" role="alert">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={isSubmitting}
          aria-invalid={!!form.formState.errors.password}
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive" role="alert">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="w-full rounded-full h-12"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner className="mr-2" />
            Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  );
}

function LoginFormFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your TrustGraph workspace to verify and anchor AI reasoning."
      footer={
        <>
          New to TrustGraph?{' '}
          <Link
            href="/register"
            className="text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
