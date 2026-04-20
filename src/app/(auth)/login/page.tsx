'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { safeRedirectPath } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const search = useSearchParams();
  const next = safeRedirectPath(search.get('next'));
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      // Hard redirect — guarantees the cookie is present in the middleware request.
      window.location.assign(next);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  });

  const onEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isSubmitting) {
      event.preventDefault();
      void submit();
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
            {/* Email */}
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

            {/* Password */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                  className="pr-9"
                  onKeyDown={onEnter}
                  {...register('password', { onBlur: () => trigger('password') })}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && (
                <p role="alert" className="text-xs text-loss">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit error */}
            {submitError && (
              <p
                role="alert"
                className="rounded-sm border px-3 py-2 text-xs"
                style={{
                  borderColor: 'rgba(255,77,106,0.4)',
                  backgroundColor: 'rgba(255,77,106,0.08)',
                  color: 'var(--color-loss)',
                }}
              >
                {submitError}
              </p>
            )}

            <Button
              type="button"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => void submit()}
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
