'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthHero } from '@/components/auth/AuthHero';
import { requestPasswordReset } from '@/lib/api/passwordReset';
import { normalizeError } from '@/lib/api/client';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
});

type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Once the request fires we always show the same generic confirmation
  // — the API is no-leak so we don't reveal whether the email exists.
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
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <AuthHero />
      <div className="flex items-center justify-center bg-bg-base p-8">
        <div className="w-full max-w-md space-y-6">
          <div>
            <Link
              href="/login"
              className="mb-4 inline-flex items-center gap-1.5 text-[11px] text-text-muted transition-colors hover:text-text-primary"
            >
              <ArrowLeft size={12} strokeWidth={1.75} />
              Back to sign in
            </Link>
            <h1 className="font-display text-2xl text-text-primary">Reset your password</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Enter the email tied to your account. If it matches, we&apos;ll issue a single-use
              reset link valid for 30 minutes.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-3 rounded-md border border-bd-subtle bg-bg-surface p-4">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-sm"
                  style={{
                    background: 'rgba(0,200,150,0.12)',
                    color: 'var(--color-profit)',
                  }}
                >
                  <Mail size={14} strokeWidth={1.75} />
                </span>
                <h2 className="font-display text-sm font-semibold text-text-primary">
                  Check your email
                </h2>
              </div>
              <p className="text-[12px] text-text-secondary">
                If an account exists with that address, we&apos;ve issued reset instructions. The
                link expires in 30 minutes; only the most recent request remains valid.
              </p>
              <p className="text-[11px] text-text-muted">
                Didn&apos;t receive anything? Email delivery is in progress — until then your
                administrator can retrieve the reset URL from the application log
                (look for <span className="font-mono">PASSWORD RESET TOKEN ISSUED</span>).
              </p>
              <Link
                href="/login"
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent-primary)]"
              >
                Return to sign in →
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="mm-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="mm-input"
                  placeholder="trader@example.com"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-[11px] text-loss">{errors.email.message}</p>
                )}
              </div>

              {submitError && (
                <div className="rounded-md border border-bd-subtle bg-tint-loss px-3 py-2 text-[11px] text-loss">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mm-btn mm-btn-mint w-full justify-center"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  'Send reset link'
                )}
              </button>

              <p className="text-center text-[11px] text-text-muted">
                Remember it after all?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
