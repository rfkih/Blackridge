'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { z } from 'zod';
import { AuthCard, AuthMark, AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/hooks/useAuth';

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

function RegisterPageContent() {
  const { register: registerUser } = useAuth();
  const search = useSearchParams();
  const prefillEmail = search.get('email') ?? '';

  const [state, setState] = useState<FormState>({ ...EMPTY, email: prefillEmail });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <AuthShell
      maxWidth={480}
      topRight={{ label: 'Already a trader?', cta: 'Sign in →', href: '/login' }}
    >
      <div role="form" aria-label="Create account" aria-busy={isSubmitting}>
        <AuthCard>
          {success ? (
            <SuccessScreen firstName={state.firstName || 'Trader'} />
          ) : (
            <>
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
                Open your desk
              </h1>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--mm-ink-1, #384151)',
                  margin: '0 0 20px',
                  lineHeight: 1.5,
                }}
              >
                Backtest, simulate, deploy. One account, one ledger.
              </p>

              <div
                className="font-mono"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  color: 'var(--mm-ink-2, #6B7280)',
                  marginBottom: 20,
                }}
              >
                <span style={{ color: 'var(--brand-700, #0A7E3F)' }}>● 01 ACCOUNT</span>
                <span
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'var(--mm-hair-2, rgba(14,17,22,0.1))',
                  }}
                />
                <span>○ 02 PROFILE</span>
                <span
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'var(--mm-hair-2, rgba(14,17,22,0.1))',
                  }}
                />
                <span>○ 03 VERIFY</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div>
                  <label htmlFor="firstName" style={FIELD_LABEL_STYLE}>
                    First name
                  </label>
                  <input
                    id="firstName"
                    autoComplete="given-name"
                    value={state.firstName}
                    onChange={(e) => setField('firstName', e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.firstName)}
                    style={FIELD_INPUT_STYLE}
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
                  <label htmlFor="lastName" style={FIELD_LABEL_STYLE}>
                    Last name
                  </label>
                  <input
                    id="lastName"
                    autoComplete="family-name"
                    value={state.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                    disabled={isSubmitting}
                    style={FIELD_INPUT_STYLE}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="email" style={FIELD_LABEL_STYLE}>
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={state.email}
                  onChange={(e) => setField('email', e.target.value)}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.email)}
                  style={FIELD_INPUT_STYLE}
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
                      color: 'var(--mm-ink-2, #6B7280)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ color: 'var(--brand-700, #0A7E3F)' }}>✓</span>
                    Looks valid
                  </div>
                ) : null}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="password" style={FIELD_LABEL_STYLE}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={state.password}
                    onChange={(e) => setField('password', e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.password)}
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
                <StrengthBars strength={strength} />
                {errors.password ? (
                  <p
                    role="alert"
                    style={{ marginTop: 4, fontSize: 11, color: 'var(--color-loss)' }}
                  >
                    {errors.password}
                  </p>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--mm-ink-2, #6B7280)', marginTop: 6 }}>
                    {strength.label}
                    {state.password.length > 0 && ` · ${state.password.length} characters`}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="inviteCode" style={FIELD_LABEL_STYLE}>
                  Invite code <span style={{ opacity: 0.5, fontWeight: 500 }}>(optional)</span>
                </label>
                <input
                  id="inviteCode"
                  placeholder="MAC-XXXX-XXXX-YYYY"
                  value={state.inviteCode}
                  onChange={(e) => setField('inviteCode', e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    ...FIELD_INPUT_STYLE,
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.05em',
                  }}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--mm-ink-1, #384151)',
                  margin: '12px 0 18px',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={state.agreed}
                  onChange={(e) => setField('agreed', e.target.checked)}
                  aria-label="Accept terms"
                  style={{
                    width: 15,
                    height: 15,
                    accentColor: 'var(--brand-500, #16B364)',
                    marginTop: 2,
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                />
                <span>
                  I agree to the{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    style={{
                      color: 'var(--mm-ink-0, #0E1116)',
                      textDecoration: 'underline',
                      textDecorationColor: 'var(--mm-hair-2, rgba(14,17,22,0.1))',
                    }}
                  >
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    style={{
                      color: 'var(--mm-ink-0, #0E1116)',
                      textDecoration: 'underline',
                      textDecorationColor: 'var(--mm-hair-2, rgba(14,17,22,0.1))',
                    }}
                  >
                    Privacy Policy
                  </Link>
                  . No funds will be transferred until verification.
                </span>
              </label>
              {errors.agreed && (
                <p
                  role="alert"
                  style={{ fontSize: 11, color: 'var(--color-loss)', marginBottom: 12 }}
                >
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
                    <Loader2 size={14} className="animate-spin" /> Creating account
                  </>
                ) : (
                  <>
                    Create account <ArrowRight size={14} strokeWidth={3} />
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
              </div>
            </>
          )}
        </AuthCard>
      </div>
    </AuthShell>
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
              background: on ? 'var(--brand-500, #16B364)' : 'var(--mm-hair-2, rgba(14,17,22,0.1))',
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
        padding: '8px 0',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(22,179,100,0.12)',
          border: '1px solid rgba(22,179,100,0.45)',
        }}
      >
        <CheckCircle2 size={32} style={{ color: 'var(--brand-700, #0A7E3F)' }} />
      </div>
      <h2
        className="font-display"
        style={{
          marginTop: 20,
          fontSize: 28,
          letterSpacing: '-0.02em',
          color: 'var(--mm-ink-0, #0E1116)',
        }}
      >
        Welcome, {firstName}.
      </h2>
      <p
        style={{
          marginTop: 8,
          maxWidth: 340,
          fontSize: 13,
          color: 'var(--mm-ink-1, #384151)',
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
          style={{
            padding: '12px 16px',
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
          <Sparkles size={14} /> Go to dashboard
        </Link>
        <Link
          href="/strategies"
          style={{
            padding: '12px 16px',
            background: 'transparent',
            color: 'var(--mm-ink-0, #0E1116)',
            border: '1px solid var(--mm-hair-2, rgba(14,17,22,0.1))',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
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
