'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { LogoMark } from '@/components/brand/Logo';

const registerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(60, 'Name is too long'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    trigger,
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    shouldFocusError: true,
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerUser(values.email, values.password, values.name);
      // Hard redirect — guarantees the cookie is present in the middleware request.
      window.location.assign('/');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed');
    }
  });

  const onEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isSubmitting) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <main
      className="relative flex min-h-screen items-center justify-center px-6 py-12"
      style={{
        backgroundColor: 'var(--bg-base)',
        backgroundImage:
          'radial-gradient(circle at 1px 1px, rgba(232, 235, 240, 0.035) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <LogoMark size={44} className="text-[var(--color-profit)]" />
          <h1
            aria-label="Meridian Edge"
            className="mt-5 font-display text-[28px] font-semibold tracking-[0.22em] text-text-primary"
          >
            <span className="text-[var(--color-profit)]">MERIDIAN</span>
            <span className="mx-2 text-text-muted">/</span>
            <span>EDGE</span>
          </h1>
          <p className="mt-3 text-[10px] uppercase tracking-[0.4em] text-text-muted">
            Create your account
          </p>
        </div>

        <form
          aria-label="Create account"
          aria-busy={isSubmitting}
          className="rounded-md border border-bd-subtle bg-bg-surface p-8 shadow-panel"
          onSubmit={submit}
          noValidate
        >
          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
              >
                Name
              </Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.name)}
                onKeyDown={onEnter}
                {...register('name', { onBlur: () => trigger('name') })}
              />
              {errors.name && (
                <p role="alert" className="text-xs text-loss">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                onKeyDown={onEnter}
                {...register('email', { onBlur: () => trigger('email') })}
              />
              {errors.email && (
                <p role="alert" className="text-xs text-loss">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                  className="pr-9"
                  onKeyDown={onEnter}
                  {...register('password', { onBlur: () => trigger('password') })}
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
              {errors.password && (
                <p role="alert" className="text-xs text-loss">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
              >
                Confirm password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  className="pr-9"
                  onKeyDown={onEnter}
                  {...register('confirmPassword', { onBlur: () => trigger('confirmPassword') })}
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
              {errors.confirmPassword && (
                <p role="alert" className="text-xs text-loss">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit error */}
            {submitError && (
              <p
                role="alert"
                className="rounded-sm border px-3 py-2 text-xs"
                style={{
                  borderColor: 'rgba(255,77,106,0.4)',
                  backgroundColor: 'rgba(255,77,106,0.08)',
                  color: 'var(--color-loss)',
                }}
              >
                {submitError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account
                </span>
              ) : (
                'Create account'
              )}
            </Button>

            <p className="pt-2 text-center text-xs text-text-secondary">
              Already registered?{' '}
              <Link
                href="/login"
                className="font-medium text-info underline-offset-4 transition hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
          v0 · slice 1
        </p>
      </div>
    </main>
  );
}
