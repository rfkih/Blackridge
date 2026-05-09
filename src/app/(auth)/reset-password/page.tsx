'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthCard, AuthMark, AuthShell } from '@/components/auth/AuthShell';
import { confirmPasswordReset } from '@/lib/api/passwordReset';
import { normalizeError } from '@/lib/api/client';

const schema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type Values = z.infer<typeof schema>;

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

function ResetPasswordContent() {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    if (!token) {
      setSubmitError('Reset token is missing. Use the link from your reset email exactly.');
      return;
    }
    try {
      await confirmPasswordReset({ token, newPassword: values.newPassword });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(normalizeError(err));
    }
  });

  const tokenMissing = !token;

  return (
    <AuthShell topRight={{ label: 'Remembered it?', cta: 'Sign in →', href: '/login' }}>
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
          Choose a new password
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--mm-ink-1, #384151)',
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          Pick something at least 8 characters. The reset link is one-shot — once you submit this
          form it can&apos;t be reused.
        </p>

        {submitted ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(22,179,100,0.08)',
                border: '1px solid rgba(22,179,100,0.25)',
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: 8,
                  background: 'rgba(22,179,100,0.18)',
                  color: 'var(--brand-700, #0A7E3F)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <CheckCircle2 size={16} strokeWidth={2} />
              </span>
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--mm-ink-0, #0E1116)',
                  }}
                >
                  Password updated
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--mm-ink-1, #384151)',
                    marginTop: 2,
                  }}
                >
                  Sign in with your new password.
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--mm-ink-1, #384151)', lineHeight: 1.5 }}>
              The reset link is now spent and cannot be reused.
            </p>

            <Link
              href="/login"
              style={{
                marginTop: 16,
                width: '100%',
                padding: '14px',
                background: 'var(--mm-ink-0, #0E1116)',
                color: '#FFFFFF',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              Continue to sign in
            </Link>
          </div>
        ) : tokenMissing ? (
          <div>
            <p
              role="alert"
              style={{
                padding: '12px 14px',
                fontSize: 12,
                borderRadius: 10,
                border: '1px solid rgba(229,72,77,0.4)',
                background: 'rgba(229,72,77,0.08)',
                color: 'var(--color-loss)',
                marginBottom: 12,
                lineHeight: 1.5,
              }}
            >
              <strong>Missing token.</strong> The link you clicked is missing the reset token. Open
              the original reset URL exactly as it was issued, or{' '}
              <Link
                href="/forgot-password"
                style={{
                  color: 'var(--brand-700, #0A7E3F)',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                request a fresh one
              </Link>
              .
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="newPassword" style={FIELD_LABEL_STYLE}>
                New password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={errors.newPassword ? 'true' : 'false'}
                  disabled={isSubmitting}
                  {...register('newPassword')}
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
              {errors.newPassword && (
                <p role="alert" style={{ marginTop: 6, fontSize: 11, color: 'var(--color-loss)' }}>
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label htmlFor="confirmPassword" style={FIELD_LABEL_STYLE}>
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                disabled={isSubmitting}
                {...register('confirmPassword')}
                style={FIELD_INPUT_STYLE}
              />
              {errors.confirmPassword && (
                <p role="alert" style={{ marginTop: 6, fontSize: 11, color: 'var(--color-loss)' }}>
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

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
              type="submit"
              disabled={isSubmitting}
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
                  <Loader2 size={14} className="animate-spin" /> Updating
                </>
              ) : (
                'Update password'
              )}
            </button>

            <Link
              href="/login"
              style={{
                marginTop: 14,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--mm-ink-2, #6B7280)',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={12} /> Back to sign in
            </Link>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
