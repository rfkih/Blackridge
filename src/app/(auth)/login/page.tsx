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

const FIELD_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--mm-ink-1, #384151)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const FIELD_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--mm-hair-2, rgba(14,17,22,0.1))',
  borderRadius: 10,
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#FFFFFF',
  color: 'var(--mm-ink-0, #0E1116)',
  outline: 'none',
};

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
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              margin: '0 0 6px',
              color: 'var(--mm-ink-0, #0E1116)',
            }}
          >
            Sign in to Machiavelli
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--mm-ink-1, #384151)',
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}
          >
            Pick up where you left off. Your bots have been running.
          </p>

          {/* Email */}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="email" style={FIELD_LABEL_STYLE}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              disabled={isSubmitting}
              onKeyDown={onEnter}
              aria-invalid={Boolean(errors.email)}
              {...register('email', { onBlur: () => trigger('email') })}
              style={FIELD_INPUT_STYLE}
            />
            {errors.email && (
              <p role="alert" style={{ marginTop: 6, fontSize: 11, color: 'var(--color-loss)' }}>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 6,
              }}
            >
              <label htmlFor="password" style={{ ...FIELD_LABEL_STYLE, marginBottom: 0 }}>
                Password
              </label>
              <Link
                href="/forgot-password"
                tabIndex={-1}
                style={{
                  fontSize: 11,
                  color: 'var(--brand-700, #0A7E3F)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Forgot?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••••••"
                disabled={isSubmitting}
                onKeyDown={onEnter}
                aria-invalid={Boolean(errors.password)}
                {...register('password', { onBlur: () => trigger('password') })}
                style={{ ...FIELD_INPUT_STYLE, paddingRight: 56 }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 12,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--mm-ink-2, #6B7280)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                {showPassword ? 'hide' : 'show'}
              </button>
            </div>
            {errors.password && (
              <p role="alert" style={{ marginTop: 6, fontSize: 11, color: 'var(--color-loss)' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Keep me signed in */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--mm-ink-1, #384151)',
              margin: '12px 0 18px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              aria-label="Keep me signed in for 30 days"
              style={{
                width: 15,
                height: 15,
                accentColor: 'var(--brand-500, #16B364)',
                margin: 0,
                cursor: 'pointer',
              }}
            />
            <span>Keep me signed in for 30 days</span>
          </label>

          {sessionExpired && !submitError && (
            <p
              role="status"
              style={{
                padding: '10px 12px',
                fontSize: 12,
                borderRadius: 10,
                border: '1px solid rgba(245,166,35,0.45)',
                background: 'rgba(245,166,35,0.10)',
                color: 'var(--color-warning)',
                margin: '0 0 12px',
              }}
            >
              Your session expired. Please sign in again to continue where you left off.
            </p>
          )}

          {submitError && (
            <p
              role="alert"
              style={{
                padding: '10px 12px',
                fontSize: 12,
                borderRadius: 10,
                border: '1px solid rgba(229,72,77,0.4)',
                background: 'rgba(229,72,77,0.08)',
                color: 'var(--color-loss)',
                margin: '0 0 12px',
              }}
            >
              {submitError}
            </p>
          )}

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void submit()}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--mm-ink-0, #0E1116)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Signing in
              </>
            ) : (
              <>
                Sign in
                <svg
                  width="13"
                  height="13"
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
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--mm-ink-2, #6B7280)',
              marginTop: 16,
              lineHeight: 1.5,
            }}
          >
            Protected by 2FA. We never custody funds.
            <br />
            By continuing you agree to our{' '}
            <Link
              href="/terms"
              style={{
                color: 'var(--mm-ink-1, #384151)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--mm-hair-2, rgba(14,17,22,0.1))',
              }}
            >
              Terms
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              style={{
                color: 'var(--mm-ink-1, #384151)',
                textDecoration: 'underline',
                textDecorationColor: 'var(--mm-hair-2, rgba(14,17,22,0.1))',
              }}
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
