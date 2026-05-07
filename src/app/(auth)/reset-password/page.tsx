'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AuthHero } from '@/components/auth/AuthHero';
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

  // Token absent in URL — show a clear error rather than a broken form.
  const tokenMissing = !token;

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
            <h1 className="font-display text-2xl text-text-primary">Choose a new password</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Pick something at least 8 characters. The reset link is one-shot — once you submit
              this form it can&apos;t be reused.
            </p>
          </div>

          {submitted ? (
            <div className="space-y-3 rounded-xl border border-bd-subtle bg-bg-surface p-4">
              <h2 className="font-display text-sm font-semibold text-text-primary">
                Password updated
              </h2>
              <p className="text-[12px] text-text-secondary">
                Sign in with your new password. The reset link is now spent and cannot be reused.
              </p>
              <Link
                href="/login"
                className="mm-btn mm-btn-mint inline-flex w-full items-center justify-center"
              >
                Continue to sign in
              </Link>
            </div>
          ) : tokenMissing ? (
            <div className="space-y-3 rounded-md border border-bd-subtle bg-tint-loss p-4">
              <h2 className="font-display text-sm font-semibold text-loss">Missing token</h2>
              <p className="text-[12px] text-text-secondary">
                The link you clicked is missing the reset token. Open the original reset URL
                exactly as it was issued, or{' '}
                <Link
                  href="/forgot-password"
                  className="font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  request a fresh one
                </Link>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="newPassword" className="mm-label">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="mm-input pr-10"
                    aria-invalid={errors.newPassword ? 'true' : 'false'}
                    {...register('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted transition-colors hover:text-text-primary"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="mt-1 text-[11px] text-loss">{errors.newPassword.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mm-label">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="mm-input"
                  aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-[11px] text-loss">{errors.confirmPassword.message}</p>
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
                  'Update password'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams must be inside a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
