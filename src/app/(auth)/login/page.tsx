'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthHero } from '@/components/auth/AuthHero';
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
  const prefillEmail = search.get('email') ?? '';
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

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

  const currentEmail = watch('email');
  const registerHref = `/register${currentEmail ? `?email=${encodeURIComponent(currentEmail)}` : ''}`;

  return (
    <div
      className="grid min-h-screen grid-cols-1 lg:grid-cols-2"
      role="form"
      aria-label="Sign in"
      aria-busy={isSubmitting}
    >
      {/* Left — shared editorial hero */}
      <AuthHero />

      {/* Right — the actual form */}
      <div
        className="flex items-center justify-center"
        style={{ padding: 40, background: 'var(--mm-bg, var(--bg-base))' }}
      >
        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--mm-mint, var(--color-profit))',
              }}
            >
              SIGN IN
            </div>
            <h2
              className="font-display"
              style={{ marginTop: 8, fontSize: 36, letterSpacing: '-0.03em', lineHeight: 1.05 }}
            >
              Welcome back.
            </h2>
            <p
              style={{
                marginTop: 6,
                fontSize: 14,
                color: 'var(--mm-ink-2, var(--text-secondary))',
              }}
            >
              Don&apos;t have an account?{' '}
              <Link
                href={registerHref}
                style={{
                  color: 'var(--mm-ink-0, var(--text-primary))',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Request access →
              </Link>
            </p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="mm-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="trader@meridian.edge"
              className="mm-input"
              disabled={isSubmitting}
              onKeyDown={onEnter}
              aria-invalid={Boolean(errors.email)}
              {...register('email', { onBlur: () => trigger('email') })}
            />
            {errors.email && (
              <p role="alert" style={{ marginTop: 6, fontSize: 11, color: 'var(--color-loss)' }}>
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="password" className="mm-label">
                Password
              </label>
              <Link
                href="/forgot-password"
                tabIndex={-1}
                className="mm-label"
                style={{ color: 'var(--mm-mint, var(--color-profit))', cursor: 'pointer' }}
              >
                Forgot?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="mm-input"
                disabled={isSubmitting}
                onKeyDown={onEnter}
                aria-invalid={Boolean(errors.password)}
                style={{ paddingRight: 56 }}
                {...register('password', { onBlur: () => trigger('password') })}
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
                  color: 'var(--mm-ink-3, var(--text-muted))',
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
              fontSize: 13,
              color: 'var(--mm-ink-2, var(--text-secondary))',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              aria-label="Keep me signed in on this device"
            />
            <span
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                display: 'grid',
                placeItems: 'center',
                background: keepSignedIn
                  ? 'var(--mm-mint, var(--color-profit))'
                  : 'var(--mm-surface-2, var(--bg-elevated))',
                color: keepSignedIn ? 'var(--mm-bg, var(--bg-base))' : 'transparent',
                border: keepSignedIn ? 'none' : '1px solid var(--mm-hair-2, var(--border-default))',
                transition: 'background 120ms, border-color 120ms',
              }}
            >
              {keepSignedIn && <Check size={10} strokeWidth={3} />}
            </span>
            Keep me signed in on this device
          </label>

          {/* Submit error */}
          {submitError && (
            <p
              role="alert"
              style={{
                padding: '10px 12px',
                fontSize: 12,
                borderRadius: 10,
                border: '1px solid rgba(255,122,122,0.4)',
                background: 'rgba(255,122,122,0.08)',
                color: 'var(--color-loss)',
              }}
            >
              {submitError}
            </p>
          )}

          <button
            type="button"
            className="mm-btn mm-btn-mint"
            disabled={isSubmitting}
            onClick={() => void submit()}
            style={{
              padding: '14px 16px',
              fontSize: 14,
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.65 : 1,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Signing in
              </>
            ) : (
              <>Sign in →</>
            )}
          </button>

          {/* Security notice — matches the pack's bottom chip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--mm-surface-2, var(--bg-elevated))',
              fontSize: 12,
              color: 'var(--mm-ink-2, var(--text-secondary))',
            }}
          >
            <ShieldCheck
              size={14}
              strokeWidth={1.75}
              style={{ color: 'var(--mm-mint, var(--color-profit))' }}
            />
            Protected by HttpOnly session cookies · rate-limited at the edge
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
