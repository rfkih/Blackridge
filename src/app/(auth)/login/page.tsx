'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthCard, AuthMark, AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/hooks/useAuth';
import { consumeSessionExpiredFlag } from '@/lib/api/client';
import { safeRedirectPath } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;


function LoginPageContent() {
  const search = useSearchParams();
  const next = safeRedirectPath(search.get('next'));
  const prefillEmail = search.get('email') ?? '';
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  // If the axios interceptor redirected us here on a 401, surface a clear
  // "your session expired" banner. Flag is one-shot.
  useEffect(() => {
    if (consumeSessionExpiredFlag()) setSessionExpired(true);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    trigger,
    watch,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: prefillEmail, password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
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

  const currentEmail = watch('email');
  const registerHref = `/register${currentEmail ? `?email=${encodeURIComponent(currentEmail)}` : ''}`;

  return (
    <AuthShell topRight={{ label: 'New here?', cta: 'Create account →', href: registerHref }}>
      <div role="form" aria-label="Sign in" aria-busy={isSubmitting}>
        <AuthCard>
          <AuthMark />

          <h1
            className="font-display"
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              margin: '0 0 8px',
              color: 'var(--text-primary)',
            }}
          >
            Sign in to Blackridge
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'var(--text-secondary)',
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}
          >
            Pick up where you left off. Your bots have been running.
          </p>

          {/* Email */}
          <div className="mb-3.5">
            <label htmlFor="email" className="br-label">
              Work email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@firm.com"
              disabled={isSubmitting}
              onKeyDown={onEnter}
              aria-invalid={Boolean(errors.email)}
              {...register('email', { onBlur: () => trigger('email') })}
              className="br-input"
            />
            {errors.email && (
              <p
                role="alert"
                className="mt-1.5 text-[12px]"
                style={{ color: 'var(--color-loss)' }}
              >
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mb-3.5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="password" className="br-label" style={{ marginBottom: 0 }}>
                Password
              </label>
              <Link
                href="/forgot-password"
                tabIndex={-1}
                className="text-[12px] font-semibold"
                style={{ color: 'var(--brand-700)', textDecoration: 'none' }}
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••••"
                disabled={isSubmitting}
                onKeyDown={onEnter}
                aria-invalid={Boolean(errors.password)}
                {...register('password', { onBlur: () => trigger('password') })}
                className="br-input"
                style={{ paddingRight: 64 }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[12px]"
                style={{
                  right: 12,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                {showPassword ? 'hide' : 'show'}
              </button>
            </div>
            {errors.password && (
              <p
                role="alert"
                className="mt-1.5 text-[12px]"
                style={{ color: 'var(--color-loss)' }}
              >
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Keep me signed in */}
          <label
            htmlFor="keep-signed-in"
            className="my-3 flex cursor-pointer items-center gap-2.5 text-[13px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <input
              id="keep-signed-in"
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              aria-label="Keep me signed in for 30 days"
              style={{
                width: 15,
                height: 15,
                accentColor: 'var(--brand-500)',
                margin: 0,
                cursor: 'pointer',
              }}
            />
            <span>Keep me signed in for 30 days</span>
          </label>

          {sessionExpired && !submitError && (
            <div
              role="status"
              className="mb-3 flex gap-2.5 rounded-xl p-3 text-[13px]"
              style={{ background: 'var(--tint-warning)', color: 'var(--text-secondary)' }}
            >
              Your session expired. Please sign in again to continue where you left off.
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="mb-3 flex gap-2.5 rounded-xl p-3 text-[13px]"
              style={{ background: 'var(--tint-loss)', color: 'var(--color-loss)' }}
            >
              {submitError}
            </div>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void submit()}
            className="br-btn br-btn-primary br-btn-lg br-btn-block"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Signing in
              </>
            ) : (
              <>
                Sign in
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>

          <div
            className="mt-4 text-center text-[12px]"
            style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}
          >
            Protected by 2FA. We never custody funds.
            <br />
            By continuing you agree to our{' '}
            <Link
              href="/terms"
              className="underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              Terms
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              className="underline"
              style={{ color: 'var(--text-secondary)' }}
            >
              Privacy Policy
            </Link>
            .
          </div>
        </AuthCard>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
