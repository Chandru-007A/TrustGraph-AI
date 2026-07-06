// frontend/app/register/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Register screen. Connects to POST /api/v1/auth/register, then auto-signs in
// the returned user (the backend issues a token pair on register).
// UX:
//   • react-hook-form + zod (mirrors backend password policy exactly)
//   • Live password-strength checklist
//   • Sonner toast for success / failure
//   • On success → push to /dashboard (auto-login per spec)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordStrength } from '@/components/auth/auth-form-fields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

const registerSchema = z.object({
  email: z.string().email('Enter a valid email'),
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be at most 50 characters')
    .optional()
    .or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Add at least one uppercase letter')
    .regex(/[a-z]/, 'Add at least one lowercase letter')
    .regex(/[0-9]/, 'Add at least one digit')
    .regex(/[^A-Za-z0-9]/, 'Add at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', displayName: '', password: '', confirmPassword: '' },
  });

  const password = useWatch({ control: form.control, name: 'password' });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSubmitting(true);
    try {
      await registerUser({
        email: values.email,
        password: values.password,
        displayName: values.displayName?.trim() || undefined,
      });
      toast.success('Account created', {
        description: "You're signed in. Welcome aboard.",
      });
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      toast.error('Could not create account', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <AuthShell
      title="Create account"
      subtitle="Set up access to the verified-reasoning platform in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
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
          <Label htmlFor="displayName">
            Display name <span className="text-muted-foreground/60 font-normal">(optional)</span>
          </Label>
          <Input
            id="displayName"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            disabled={isSubmitting}
            aria-invalid={!!form.formState.errors.displayName}
            {...form.register('displayName')}
          />
          {form.formState.errors.displayName && (
            <p className="text-xs text-destructive" role="alert">
              {form.formState.errors.displayName.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            disabled={isSubmitting}
            aria-invalid={!!form.formState.errors.password}
            {...form.register('password')}
          />
          <PasswordStrength password={password ?? ''} />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive" role="alert">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            disabled={isSubmitting}
            aria-invalid={!!form.formState.errors.confirmPassword}
            {...form.register('confirmPassword')}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-xs text-destructive" role="alert">
              {form.formState.errors.confirmPassword.message}
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
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
