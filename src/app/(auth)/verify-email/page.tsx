'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthHero } from '@/components/auth/AuthHero';
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
      setErrorMsg('No verification token in the URL. Open the link from your verification email exactly.');
      return;
    }
    let cancelled = false;
    setPhase('verifying');
    verifyEmail(token)
      .then(() => {
        if (cancelled) return;
        // Reflect the backend's flip in the in-memory user so the dashboard
        // banner clears as soon as the user returns. Without this, the
        // banner reads the stale emailVerified=false from the auth store.
        const store = useAuthStore.getState();
        if (store.user && !store.user.emailVerified) {
          store.setUser({ ...store.user, emailVerified: true });
        }
        // Drop the cached /me so any subsequent fetcher pulls fresh state
        // (covers other tabs reading from React Query rather than the store).
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

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <AuthHero />
      <div className="flex items-center justify-center bg-bg-base p-8">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="font-display text-2xl text-text-primary">Verify your email</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {phase === 'verifying' && 'Confirming your verification token…'}
              {phase === 'ok' && 'Your email is now verified.'}
              {phase === 'error' && 'We could not verify this token.'}
              {phase === 'idle' && 'Loading…'}
            </p>
          </div>

          <div className="rounded-md border border-bd-subtle bg-bg-surface p-4">
            {phase === 'verifying' && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[12px]">One moment…</span>
              </div>
            )}
            {phase === 'ok' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-sm"
                    style={{
                      background: 'rgba(0,200,150,0.15)',
                      color: 'var(--color-profit)',
                    }}
                  >
                    <CheckCircle2 size={14} strokeWidth={1.75} />
                  </span>
                  <h2 className="font-display text-sm font-semibold text-text-primary">
                    Email verified
                  </h2>
                </div>
                <p className="text-[12px] text-text-secondary">
                  Thanks for confirming. You can return to the dashboard now.
                </p>
                <Link
                  href="/"
                  className="mm-btn mm-btn-mint inline-flex w-full items-center justify-center"
                >
                  Continue to dashboard
                </Link>
              </div>
            )}
            {phase === 'error' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-sm"
                    style={{
                      background: 'rgba(255,77,106,0.12)',
                      color: 'var(--color-loss)',
                    }}
                  >
                    <XCircle size={14} strokeWidth={1.75} />
                  </span>
                  <h2 className="font-display text-sm font-semibold text-loss">
                    Verification failed
                  </h2>
                </div>
                <p className="text-[12px] text-text-secondary">
                  {errorMsg ?? 'The token is invalid, used, or expired.'}
                </p>
                <p className="text-[11px] text-text-muted">
                  Sign in and use the &quot;Verify your email&quot; banner on the dashboard to
                  request a fresh verification link.
                </p>
                <Link
                  href="/login"
                  className="mm-btn inline-flex w-full items-center justify-center"
                >
                  Back to sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
