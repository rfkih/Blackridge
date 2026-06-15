'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthCard, AuthMark, AuthShell } from '@/components/auth/AuthShell';
import { requestPasswordReset } from '@/lib/api/passwordReset';
import { normalizeError } from '@/lib/api/client';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

type Values = z.infer<typeof schema>;

const FIELD_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const FIELD_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--border-default)',
  borderRadius: 10,
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  outline: 'none',
};

export default function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { email: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await requestPasswordReset({ email: values.email });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(normalizeError(err));
    }
  });

  return (
    <AuthShell topRight={{ label: 'Remember it?', cta: 'Sign in →', href: '/login' }}>
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
            color: 'var(--text-primary)',
          }}
        >
          Reset your password
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          Enter the email tied to your account. If it matches, we&apos;ll issue a single-use reset
          link valid for 30 minutes.
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
                <Mail size={16} strokeWidth={2} />
              </span>
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  Check your email
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginTop: 2,
                  }}
                >
                  Reset instructions are on their way.
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              If an account exists with that address, we&apos;ve issued reset instructions. The link
              expires in 30 minutes; only the most recent request remains valid.
            </p>
            <p
              style={{
                marginTop: 12,
                fontSize: 11,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              Didn&apos;t receive anything? Email delivery is in progress — until then your
              administrator can retrieve the reset URL from the application log (look for{' '}
              <span style={{ fontFamily: 'var(--font-mono)' }}>PASSWORD RESET TOKEN ISSUED</span>
              ).
            </p>
            <Link
              href="/login"
              style={{
                marginTop: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--brand-700, #0A7E3F)',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={12} /> Return to sign in
            </Link>
          </div>
        ) : (
          <div
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="email" style={FIELD_LABEL_STYLE}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={errors.email ? 'true' : 'false'}
                disabled={isSubmitting}
                {...register('email')}
                style={FIELD_INPUT_STYLE}
              />
              {errors.email && (
                <p role="alert" style={{ marginTop: 6, fontSize: 11, color: 'var(--color-loss)' }}>
                  {errors.email.message}
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
              type="button"
              onClick={() => void submit()}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '14px',
                background: 'var(--text-primary)',
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
                  <Loader2 size={14} className="animate-spin" /> Sending
                </>
              ) : (
                'Send reset link'
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
                color: 'var(--text-muted)',
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={12} /> Back to sign in
            </Link>
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}
