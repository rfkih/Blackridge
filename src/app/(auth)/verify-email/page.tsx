'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthCard, AuthMark, AuthShell } from '@/components/auth/AuthShell';
import { verifyEmail } from '@/lib/api/emailVerification';
import { normalizeError } from '@/lib/api/client';
import { useAuthStore } from '@/store/authStore';

type Phase = 'idle' | 'verifying' | 'ok' | 'error';

function VerifyEmailContent() {
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) {
      setPhase('error');
      setErrorMsg(
        'No verification token in the URL. Open the link from your verification email exactly.',
      );
      return;
    }
    let cancelled = false;
    setPhase('verifying');
    verifyEmail(token)
      .then(() => {
        if (cancelled) return;

        const store = useAuthStore.getState();
        if (store.user && !store.user.emailVerified) {
          store.setUser({ ...store.user, emailVerified: true });
        }
        queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        setPhase('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        setPhase('error');
        setErrorMsg(normalizeError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [token, queryClient]);

  const subtitle =
    phase === 'verifying'
      ? 'Confirming your verification token…'
      : phase === 'ok'
        ? 'Your email is now verified.'
        : phase === 'error'
          ? 'We could not verify this token.'
          : 'Loading…';

  return (
    <AuthShell topRight={{ label: 'Done?', cta: 'Sign in →', href: '/login' }}>
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
            color: 'var(--text-primary, #0E1116)',
          }}
        >
          Verify your email
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary, #384151)',
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>

        {phase === 'verifying' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--bg-surface, #F7FAF8)',
              border: '1px solid var(--border-default, rgba(14,17,22,0.1))',
              color: 'var(--text-secondary, #384151)',
              fontSize: 13,
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            <span>One moment…</span>
          </div>
        )}

        {phase === 'ok' && (
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
                    color: 'var(--text-primary, #0E1116)',
                  }}
                >
                  Email verified
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary, #384151)',
                    marginTop: 2,
                  }}
                >
                  Thanks for confirming. You can return to the dashboard now.
                </div>
              </div>
            </div>

            <Link
              href="/"
              style={{
                width: '100%',
                padding: '14px',
                background: 'var(--text-primary, #0E1116)',
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
              Continue to dashboard
            </Link>
          </div>
        )}

        {phase === 'error' && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(229,72,77,0.08)',
                border: '1px solid rgba(229,72,77,0.25)',
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: 8,
                  background: 'rgba(229,72,77,0.18)',
                  color: 'var(--color-loss)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <XCircle size={16} strokeWidth={2} />
              </span>
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--color-loss)',
                  }}
                >
                  Verification failed
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary, #384151)',
                    marginTop: 2,
                  }}
                >
                  {errorMsg ?? 'The token is invalid, used, or expired.'}
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: 11,
                color: 'var(--text-muted, #6B7280)',
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              Sign in and use the &quot;Verify your email&quot; banner on the dashboard to request a
              fresh verification link.
            </p>

            <Link
              href="/login"
              style={{
                width: '100%',
                padding: '14px',
                background: 'transparent',
                color: 'var(--text-primary, #0E1116)',
                border: '1px solid var(--border-default, rgba(14,17,22,0.1))',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Back to sign in
            </Link>
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
