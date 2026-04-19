'use client';

// SLICE 1: Login — RHF + Zod → useAuth.login → router.push(next ?? '/').
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    trigger,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
      router.push(next);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  });

  const onEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isSubmitting) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center px-6 py-12"
      style={{
        backgroundColor: 'var(--bg-base)',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(232, 235, 240, 0.035) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1
            aria-label="Blackheart"
            className="font-display text-4xl font-semibold tracking-[0.22em] text-text-primary"
          >
            BLACKHEART
            <span aria-hidden className="ml-1 text-info">
              .
            </span>
          </h1>
          <p className="mt-3 text-[10px] uppercase tracking-[0.4em] text-text-muted">
            Algorithmic trading platform
          </p>
        </div>

        <div
          role="form"
          aria-label="Sign in"
          aria-busy={isSubmitting}
          className="rounded-md border border-bd-subtle bg-bg-surface p-8 shadow-panel"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                onKeyDown={onEnter}
                {...register('email', { onBlur: () => trigger('email') })}
              />
              {errors.email && (
                <p role="alert" className="text-xs text-loss">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
                >
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.password)}
                onKeyDown={onEnter}
                {...register('password', { onBlur: () => trigger('password') })}
              />
              {errors.password && (
                <p role="alert" className="text-xs text-loss">
                  {errors.password.message}
                </p>
              )}
            </div>

            {submitError && (
              <p
                role="alert"
                className="border-loss/40 bg-loss/10 rounded-sm border px-3 py-2 text-xs text-loss"
              >
                {submitError}
              </p>
            )}

            <Button
              type="button"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => submit()}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in
                </span>
              ) : (
                'Sign in'
              )}
            </Button>

            <p className="pt-2 text-center text-xs text-text-secondary">
              No account yet?{' '}
              <Link
                href="/register"
                className="font-medium text-info underline-offset-4 transition hover:underline"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
          v0 · slice 1
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
