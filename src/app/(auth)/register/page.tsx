'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { AuthModeSwitch } from '@/components/auth/AuthModeSwitch';
import { cn } from '@/lib/utils';

// ─── Schemas per step ─────────────────────────────────────────────────────────

const credentialsSchema = z
  .object({
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password is too long'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60, 'Name is too long'),
  phoneNumber: z
    .string()
    .max(30, 'Phone number is too long')
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^[+\d\s()-]{6,}$/.test(v), {
      message: 'Phone looks invalid',
    }),
});

type Step = 0 | 1 | 2;

interface WizardState {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  phoneNumber: string;
  agreed: boolean;
}

const EMPTY_STATE: WizardState = {
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
  phoneNumber: '',
  agreed: false,
};

// Step meta — used by the stepper + the per-step title/subtitle.
const STEPS: Array<{ title: string; subtitle: string }> = [
  { title: 'Credentials', subtitle: 'Secure access to your account.' },
  { title: 'Profile', subtitle: 'Tell us who you are.' },
  { title: 'Review', subtitle: 'Confirm and create your account.' },
];

// ─── Password strength ────────────────────────────────────────────────────────

interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

/**
 * Deliberately simple, offline strength estimate — counts character-class
 * diversity + length. Close enough for UI feedback; real policy enforcement
 * happens on the backend at `RegisterUserRequest.Size`.
 */
function scorePassword(pw: string): Strength {
  if (!pw) return { score: 0, label: 'Empty', color: 'var(--text-muted)' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(score, 4) as Strength['score'];
  const meta: Record<Strength['score'], Omit<Strength, 'score'>> = {
    0: { label: 'Weak', color: 'var(--color-loss)' },
    1: { label: 'Weak', color: 'var(--color-loss)' },
    2: { label: 'Fair', color: 'var(--color-warning)' },
    3: { label: 'Good', color: 'var(--color-info)' },
    4: { label: 'Strong', color: 'var(--color-profit)' },
  };
  return { score: clamped, ...meta[clamped] };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  // useSearchParams forces the page out of static prerender; the real body
  // sits inside a Suspense boundary so Next 14's builder stays happy.
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const { register: registerUser } = useAuth();
  const search = useSearchParams();
  // Pre-fill email when the user jumped over from /login with typed value.
  const prefillEmail = search.get('email') ?? '';

  const [step, setStep] = useState<Step>(0);
  const [state, setState] = useState<WizardState>({ ...EMPTY_STATE, email: prefillEmail });
  const [errors, setErrors] = useState<Partial<Record<keyof WizardState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const setField = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const validateStep = useCallback(
    (which: Step): boolean => {
      const next: Partial<Record<keyof WizardState, string>> = {};
      if (which === 0) {
        const parsed = credentialsSchema.safeParse({
          email: state.email,
          password: state.password,
          confirmPassword: state.confirmPassword,
        });
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const key = issue.path[0];
            if (typeof key === 'string') next[key as keyof WizardState] = issue.message;
          }
        }
      } else if (which === 1) {
        const parsed = profileSchema.safeParse({
          name: state.name,
          phoneNumber: state.phoneNumber,
        });
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const key = issue.path[0];
            if (typeof key === 'string') next[key as keyof WizardState] = issue.message;
          }
        }
      } else if (which === 2) {
        if (!state.agreed) next.agreed = 'Please accept the terms to continue.';
      }
      setErrors((prev) => ({ ...prev, ...next }));
      return Object.keys(next).length === 0;
    },
    [state],
  );

  const goNext = useCallback(() => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(2, s + 1) as Step);
  }, [step, validateStep]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1) as Step);
    setSubmitError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2)) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await registerUser(state.email, state.password, state.name, state.phoneNumber);
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [registerUser, state, validateStep]);

  return (
    <div className="w-full max-w-md">
      <div className="mb-4">
        <AuthModeSwitch current="register" />
      </div>

      <div className="relative overflow-hidden rounded-lg border border-bd-subtle bg-bg-surface shadow-panel">
        {/* Top accent line — subtle hairline that animates with progress. */}
        <ProgressBar step={step} success={success} />

        <div className="p-7">
          <AnimatePresence mode="wait" initial={false}>
            {success ? (
              <SuccessScreen key="success" name={state.name} />
            ) : (
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <Stepper current={step} />

                <div className="mt-6">
                  <h2 className="font-display text-[18px] font-semibold text-text-primary">
                    {STEPS[step].title}
                  </h2>
                  <p className="mt-1 text-[12px] text-text-secondary">{STEPS[step].subtitle}</p>
                </div>

                <div className="mt-6">
                  {step === 0 && (
                    <CredentialsStep
                      state={state}
                      errors={errors}
                      setField={setField}
                      onEnter={goNext}
                    />
                  )}
                  {step === 1 && (
                    <ProfileStep
                      state={state}
                      errors={errors}
                      setField={setField}
                      onEnter={goNext}
                    />
                  )}
                  {step === 2 && (
                    <ReviewStep
                      state={state}
                      errors={errors}
                      setField={setField}
                      submitError={submitError}
                    />
                  )}
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={step === 0 || isSubmitting}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-sm px-3 py-2 text-[12px] text-text-secondary transition-colors',
                      'hover:bg-bg-hover hover:text-text-primary',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                    )}
                  >
                    <ArrowLeft size={12} /> Back
                  </button>

                  {step < 2 ? (
                    <Button
                      type="button"
                      onClick={goNext}
                      className="gap-1.5"
                      disabled={isSubmitting}
                    >
                      Continue <ArrowRight size={14} />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        void submit();
                      }}
                      className="gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Creating account
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} /> Create account
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {!success && (
        <p className="mt-5 text-center text-xs text-text-secondary">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-info underline-offset-4 transition hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, success }: { step: Step; success: boolean }) {
  const pct = success ? 100 : ((step + 1) / STEPS.length) * 100;
  return (
    <div aria-hidden="true" className="h-[3px] w-full bg-bg-elevated">
      <motion.div
        className="h-full"
        style={{ background: 'var(--color-profit)' }}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Registration progress">
      {STEPS.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={s.title} className="flex items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border font-mono text-[10px] font-semibold transition-colors',
                done && 'border-[var(--color-profit)] bg-[var(--color-profit)] text-text-inverse',
                active &&
                  'border-[var(--color-profit)] bg-[var(--accent-glow)] text-[var(--color-profit)]',
                !done && !active && 'border-bd-subtle text-text-muted',
              )}
            >
              {done ? <Check size={12} strokeWidth={2.5} /> : i + 1}
            </span>
            <span
              className={cn(
                'label-caps !text-[10px]',
                active ? '!text-text-primary' : !done && '!text-text-muted',
              )}
            >
              {s.title}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden="true" className="ml-1 h-px w-6 bg-bd-subtle" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Field primitives ─────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  icon?: React.ElementType;
  error?: string;
  hint?: string;
  isValid?: boolean;
  children: React.ReactNode;
}

function Field({ id, label, icon: Icon, error, hint, isValid, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-text-secondary"
      >
        {Icon && <Icon size={11} strokeWidth={1.75} aria-hidden="true" />}
        {label}
        {isValid && !error && (
          <CheckCircle2
            size={11}
            className="ml-auto text-[var(--color-profit)]"
            aria-hidden="true"
          />
        )}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] text-loss">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// ─── Step 1: Credentials ──────────────────────────────────────────────────────

interface StepProps {
  state: WizardState;
  errors: Partial<Record<keyof WizardState, string>>;
  setField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onEnter?: () => void;
}

function CredentialsStep({ state, errors, setField, onEnter }: StepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = useMemo(() => scorePassword(state.password), [state.password]);
  const emailValid = useMemo(
    () => z.string().email().safeParse(state.email).success,
    [state.email],
  );
  const matches =
    state.password.length > 0 &&
    state.confirmPassword.length > 0 &&
    state.password === state.confirmPassword;

  return (
    <div className="space-y-5">
      <Field id="email" label="Email" icon={Mail} error={errors.email} isValid={emailValid}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={state.email}
          onChange={(e) => setField('email', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          aria-invalid={Boolean(errors.email)}
        />
      </Field>

      <Field
        id="password"
        label="Password"
        error={errors.password}
        hint="At least 8 characters. Mix of case, digits, and symbols for strong."
      >
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            value={state.password}
            onChange={(e) => setField('password', e.target.value)}
            className="pr-9"
            aria-invalid={Boolean(errors.password)}
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
        <StrengthMeter value={state.password} strength={strength} />
      </Field>

      <Field
        id="confirmPassword"
        label="Confirm password"
        error={errors.confirmPassword}
        isValid={matches}
      >
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            value={state.confirmPassword}
            onChange={(e) => setField('confirmPassword', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onEnter) {
                e.preventDefault();
                onEnter();
              }
            }}
            className="pr-9"
            aria-invalid={Boolean(errors.confirmPassword)}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
            className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:text-text-secondary"
          >
            {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </Field>
    </div>
  );
}

function StrengthMeter({ value, strength }: { value: string; strength: Strength }) {
  if (!value) return null;
  return (
    <div className="space-y-1 pt-1" aria-live="polite">
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[3px] flex-1 rounded-full transition-colors"
            style={{
              background: i < strength.score ? strength.color : 'var(--bg-elevated)',
            }}
          />
        ))}
      </div>
      <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
        <span style={{ color: strength.color }}>{strength.label}</span>
        <span className="text-text-muted">{value.length} chars</span>
      </p>
    </div>
  );
}

// ─── Step 2: Profile ──────────────────────────────────────────────────────────

function ProfileStep({ state, errors, setField, onEnter }: StepProps) {
  return (
    <div className="space-y-5">
      <Field id="name" label="Full name" icon={User} error={errors.name}>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Jane Trader"
          value={state.name}
          onChange={(e) => setField('name', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          aria-invalid={Boolean(errors.name)}
        />
      </Field>

      <Field
        id="phoneNumber"
        label="Phone number (optional)"
        icon={Phone}
        error={errors.phoneNumber}
        hint="Used only for security alerts. We won't call you."
      >
        <Input
          id="phoneNumber"
          type="tel"
          autoComplete="tel"
          placeholder="+1 (555) 555-0123"
          value={state.phoneNumber}
          onChange={(e) => setField('phoneNumber', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
          aria-invalid={Boolean(errors.phoneNumber)}
        />
      </Field>
    </div>
  );
}

// ─── Step 3: Review ───────────────────────────────────────────────────────────

interface ReviewProps {
  state: WizardState;
  errors: Partial<Record<keyof WizardState, string>>;
  setField: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  submitError: string | null;
}

function ReviewStep({ state, errors, setField, submitError }: ReviewProps) {
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-bd-subtle rounded-md border border-bd-subtle bg-bg-base">
        <ReviewRow label="Email" value={state.email} />
        <ReviewRow label="Name" value={state.name} />
        <ReviewRow
          label="Phone"
          value={state.phoneNumber || <span className="text-text-muted">—</span>}
        />
      </dl>

      {/* Nested checkbox label — valid association; rule's heuristic can't
          see it through the wrapper <span>. Route placeholders resolve to
          the app's 404 until the docs pages ship. */}
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-bd-subtle bg-bg-base p-3 transition-colors hover:bg-bg-elevated">
        <input
          type="checkbox"
          checked={state.agreed}
          onChange={(e) => setField('agreed', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-profit)]"
          aria-invalid={Boolean(errors.agreed)}
          aria-label="Accept terms of service and privacy policy"
        />
        <span className="text-[12px] leading-relaxed text-text-secondary">
          I agree to the{' '}
          <Link
            href="/terms"
            target="_blank"
            className="text-info underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/privacy"
            target="_blank"
            className="text-info underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          . I understand that trading crypto involves risk.
        </span>
      </label>
      {errors.agreed && (
        <p role="alert" className="text-[11px] text-loss">
          {errors.agreed}
        </p>
      )}

      {submitError && (
        <p
          role="alert"
          className="rounded-sm border px-3 py-2 text-[12px]"
          style={{
            borderColor: 'rgba(255,77,106,0.4)',
            backgroundColor: 'rgba(255,77,106,0.08)',
            color: 'var(--color-loss)',
          }}
        >
          {submitError}
        </p>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="label-caps">{label}</dt>
      <dd className="font-mono text-[12px] tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

// ─── Success ──────────────────────────────────────────────────────────────────

function SuccessScreen({ name }: { name: string }) {
  const firstName = name.trim().split(/\s+/)[0] ?? 'Trader';
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex flex-col items-center py-4 text-center"
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: 'rgba(0,200,150,0.12)',
          border: '1px solid rgba(0,200,150,0.4)',
        }}
      >
        <CheckCircle2 size={32} className="text-[var(--color-profit)]" aria-hidden="true" />
      </motion.div>

      <h2 className="mt-5 font-display text-[20px] font-semibold text-text-primary">
        Welcome, {firstName}
      </h2>
      <p className="mt-1.5 max-w-sm text-[13px] text-text-secondary">
        Your account is ready. Next, connect a Binance account and configure your first strategy.
      </p>

      <div className="mt-6 flex w-full flex-col gap-2">
        <Button asChild className="w-full gap-2">
          <Link href="/">
            <Sparkles size={14} /> Go to dashboard
          </Link>
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link href="/strategies">Configure strategies</Link>
        </Button>
      </div>
    </motion.div>
  );
}
