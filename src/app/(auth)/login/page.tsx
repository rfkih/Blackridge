'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { safeRedirectPath } from '@/lib/utils';
import { AuthModeSwitch } from '@/components/auth/AuthModeSwitch';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const search = useSearchParams();
  const next = safeRedirectPath(search.get('next'));
  const prefillEmail = search.get('email') ?? '';
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    trigger,
    watch,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: prefillEmail, password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
      // Hard redirect — guarantees the cookie is present in the middleware request.
      window.location.assign(next);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  });

  const onEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isSubmitting) {
      event.preventDefault();
      void submit();
    }
  };

  // Carry the currently-typed email forward if the user decides to switch
  // over to register. Stringified into `?email=` by the switcher itself —
  // we just need to keep the URL fresh as the user types.
  const currentEmail = watch('email');
  const registerHref = `/register${currentEmail ? `?email=${encodeURIComponent(currentEmail)}` : ''}`;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4">
        <AuthModeSwitch current="login" />
      </div>

      <div
        role="form"
        aria-label="Sign in"
        aria-busy={isSubmitting}
        className="rounded-md border border-bd-subtle bg-bg-surface p-8 shadow-panel"
      >
        <div className="space-y-5">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-text-primary">
              Welcome back
            </h2>
            <p className="mt-1 text-[12px] text-text-secondary">
              Sign in to continue to your desk.
            </p>
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
              placeholder="you@company.com"
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
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
              >
                Password
              </Label>
              {/* Placeholder — password reset route will be added when the
                  backend exposes it. Kept visible so the sign-in card has
                  the affordance users expect. */}
              <Link
                href="/forgot-password"
                className="text-[10px] text-text-muted transition-colors hover:text-text-secondary"
                tabIndex={-1}
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
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

          <Button
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={() => {
              void submit();
            }}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in
              </span>
            ) : (
              'Sign in'
            )}
          </Button>

          {/* Secondary CTA — visible button, not a text link. New users see a
              real path forward the moment they land here. */}
          <div className="relative pt-2">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <span className="w-full border-t border-bd-subtle" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-bg-surface px-3 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted">
                New to Meridian Edge?
              </span>
            </div>
          </div>

          <Button asChild variant="outline" className="w-full">
            <Link href={registerHref}>Create a free account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
