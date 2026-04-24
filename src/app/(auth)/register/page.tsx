'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Check, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { AuthHero } from '@/components/auth/AuthHero';
import { useAuth } from '@/hooks/useAuth';

/**
 * Backend contract: `registerUser(email, password, fullName, phoneNumber?)`.
 * The design shows first + last name split, so we concatenate on submit.
 * Phone number is not in the design pack — the backend accepts it as
 * optional so we simply don't expose it here.
 */
const formSchema = z
  .object({
    firstName: z.string().min(1, 'Required').max(40),
    lastName: z.string().max(40).optional().or(z.literal('')),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(100),
    inviteCode: z.string().max(40).optional().or(z.literal('')),
    agreed: z.boolean(),
  })
  .refine((v) => v.agreed, { message: 'You must accept the terms', path: ['agreed'] });

type FormState = z.infer<typeof formSchema>;

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  inviteCode: '',
  agreed: false,
};

// ─── Password strength — 5 segments like the design pack ─────────────────────

interface Strength {
  score: 0 | 1 | 2 | 3 | 4 | 5;
  label: string;
}

function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: 'Empty' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(score, 5) as Strength['score'];
  const labels: Record<Strength['score'], string> = {
    0: 'Empty',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
    5: 'Very strong',
  };
  return { score: clamped, label: labels[clamped] };
}

// ─── Page ────────────────────────────────────────────────────────────────────

function RegisterPageContent() {
  const { register: registerUser } = useAuth();
  const search = useSearchParams();
  const prefillEmail = search.get('email') ?? '';

  const [state, setState] = useState<FormState>({ ...EMPTY, email: prefillEmail });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const strength = useMemo(() => scorePassword(state.password), [state.password]);
  const emailValid = useMemo(
    () => z.string().email().safeParse(state.email).success,
    [state.email],
  );

  const submit = useCallback(async () => {
    setSubmitError(null);
    const parsed = formSchema.safeParse(state);
    if (!parsed.success) {
      const next: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') next[key as keyof FormState] = issue.message;
      }
      setErrors(next);
      return;
    }
    setIsSubmitting(true);
    try {
      const fullName = [state.firstName, state.lastName]
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim())
        .join(' ');
      await registerUser(state.email, state.password, fullName, undefined);
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [registerUser, state]);

  return (
    <div
      className="grid min-h-screen grid-cols-1 lg:grid-cols-2"
      role="form"
      aria-label="Create account"
      aria-busy={isSubmitting}
    >
      <AuthHero kicker="MERIDIAN · EDGE · INVITE" tag="BETA · BY INVITATION" />

      <div
        className="flex items-center justify-center"
        style={{ padding: 40, background: 'var(--mm-bg, var(--bg-base))' }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {success ? (
            <SuccessScreen firstName={state.firstName || 'Trader'} />
          ) : (
            <>
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
                  CREATE ACCOUNT
                </div>
                <h2
                  className="font-display"
                  style={{
                    marginTop: 8,
                    fontSize: 34,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.05,
                  }}
                >
                  Open your desk.
                </h2>
                <p
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    color: 'var(--mm-ink-2, var(--text-secondary))',
                  }}
                >
                  Already a trader?{' '}
                  <Link
                    href="/login"
                    style={{
                      color: 'var(--mm-ink-0, var(--text-primary))',
                      textDecoration: 'underline',
                      textUnderlineOffset: 3,
                    }}
                  >
                    Sign in →
                  </Link>
                </p>
              </div>

              {/* Step indicator — single visible step; the rest are aspirational
                  and render per the design pack. */}
              <div
                className="font-mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  color: 'var(--mm-ink-3, var(--text-muted))',
                }}
              >
                <span style={{ color: 'var(--mm-mint, var(--color-profit))' }}>● 01 ACCOUNT</span>
                <span
                  style={{ flex: 1, height: 1, background: 'var(--mm-hair, var(--border-subtle))' }}
                />
                <span>○ 02 PROFILE</span>
                <span
                  style={{ flex: 1, height: 1, background: 'var(--mm-hair, var(--border-subtle))' }}
                />
                <span>○ 03 VERIFY</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label htmlFor="firstName" className="mm-label">
                    First name
                  </label>
                  <input
                    id="firstName"
                    autoComplete="given-name"
                    className="mm-input"
                    value={state.firstName}
                    onChange={(e) => setField('firstName', e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.firstName)}
                  />
                  {errors.firstName && (
                    <p
                      role="alert"
                      style={{ marginTop: 4, fontSize: 11, color: 'var(--color-loss)' }}
                    >
                      {errors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="lastName" className="mm-label">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    autoComplete="family-name"
                    className="mm-input"
                    value={state.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="mm-label">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="mm-input"
                  value={state.email}
                  onChange={(e) => setField('email', e.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email ? (
                  <p
                    role="alert"
                    style={{ marginTop: 6, fontSize: 11, color: 'var(--color-loss)' }}
                  >
                    {errors.email}
                  </p>
                ) : emailValid ? (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: 'var(--mm-ink-3, var(--text-muted))',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ color: 'var(--mm-mint, var(--color-profit))' }}>✓</span>
                    Looks valid
                  </div>
                ) : null}
              </div>

              <div>
                <label htmlFor="password" className="mm-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  className="mm-input"
                  value={state.password}
                  onChange={(e) => setField('password', e.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                />
                <StrengthBars strength={strength} />
                {errors.password ? (
                  <p
                    role="alert"
                    style={{ marginTop: 4, fontSize: 11, color: 'var(--color-loss)' }}
                  >
                    {errors.password}
                  </p>
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--mm-ink-3, var(--text-muted))',
                      marginTop: 6,
                    }}
                  >
                    {strength.label}
                    {state.password.length > 0 && ` · ${state.password.length} characters`}
                  </div>
                )}
              </div>

              {/* Invite code — cosmetic in the current backend (no invite
               *  gating yet). Kept for visual parity with the design pack so
               *  the form shape matches on first render. When backend invite
               *  gating ships, wire this value into the register request. */}
              <div>
                <label htmlFor="inviteCode" className="mm-label">
                  Invite code
                </label>
                <input
                  id="inviteCode"
                  className="mm-input"
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
                  placeholder="MER-XXXX-XXXX-YYYY"
                  value={state.inviteCode}
                  onChange={(e) => setField('inviteCode', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--mm-ink-2, var(--text-secondary))',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={state.agreed}
                  onChange={(e) => setField('agreed', e.target.checked)}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  aria-label="Accept terms"
                />
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    flexShrink: 0,
                    marginTop: 2,
                    display: 'grid',
                    placeItems: 'center',
                    background: state.agreed
                      ? 'var(--mm-mint, var(--color-profit))'
                      : 'var(--mm-surface-2, var(--bg-elevated))',
                    color: state.agreed ? 'var(--mm-bg, var(--bg-base))' : 'transparent',
                    border: state.agreed
                      ? 'none'
                      : '1px solid var(--mm-hair-2, var(--border-default))',
                    transition: 'background 120ms',
                  }}
                >
                  {state.agreed && <Check size={10} strokeWidth={3} />}
                </span>
                <span>
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    style={{
                      color: 'var(--mm-ink-0, var(--text-primary))',
                      textDecoration: 'underline',
                    }}
                  >
                    Terms
                  </Link>{' '}
                  &amp;{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    style={{
                      color: 'var(--mm-ink-0, var(--text-primary))',
                      textDecoration: 'underline',
                    }}
                  >
                    Market-Data Addendum
                  </Link>
                  . No funds will be transferred until verification.
                </span>
              </label>
              {errors.agreed && (
                <p role="alert" style={{ fontSize: 11, color: 'var(--color-loss)' }}>
                  {errors.agreed}
                </p>
              )}

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
                    <Loader2 size={14} className="animate-spin" /> Creating account
                  </>
                ) : (
                  <>
                    Continue to profile <ArrowRight size={14} />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StrengthBars({ strength }: { strength: Strength }) {
  return (
    <div aria-live="polite" style={{ display: 'flex', gap: 4, marginTop: 8 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const on = i <= strength.score;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: on
                ? 'var(--mm-mint, var(--color-profit))'
                : 'var(--mm-hair-2, var(--border-default))',
              transition: 'background 120ms',
            }}
          />
        );
      })}
    </div>
  );
}

function SuccessScreen({ firstName }: { firstName: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '16px 0',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--mm-mint-soft, var(--accent-glow))',
          border: '1px solid var(--mm-mint-edge, var(--border-default))',
        }}
      >
        <CheckCircle2 size={32} style={{ color: 'var(--mm-mint, var(--color-profit))' }} />
      </div>
      <h2
        className="font-display"
        style={{ marginTop: 20, fontSize: 28, letterSpacing: '-0.02em' }}
      >
        Welcome, {firstName}.
      </h2>
      <p
        style={{
          marginTop: 8,
          maxWidth: 340,
          fontSize: 13,
          color: 'var(--mm-ink-2, var(--text-secondary))',
        }}
      >
        Your desk is ready. Connect a broker and configure your first strategy.
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          maxWidth: 280,
          marginTop: 24,
        }}
      >
        <Link
          href="/"
          className="mm-btn mm-btn-mint"
          style={{
            padding: '12px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Sparkles size={14} /> Go to dashboard
        </Link>
        <Link
          href="/strategies"
          className="mm-btn"
          style={{
            padding: '12px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          Configure strategies
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
