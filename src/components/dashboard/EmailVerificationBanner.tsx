'use client';

import { Loader2, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { resendVerificationEmail } from '@/lib/api/emailVerification';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';

/**
 * Sticky reminder shown above the dashboard while the user's email is
 * unverified. Currently soft — verification is not a hard gate at login,
 * since email delivery isn't wired in. The reminder asks the user to click
 * the verify URL their administrator can pull from the application log
 * (look for {@code EMAIL VERIFICATION TOKEN ISSUED}). When SMTP comes
 * online, no UI change is needed — the resend button already calls the
 * backend issue endpoint.
 */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [pending, setPending] = useState(false);

  if (!user || user.emailVerified !== false) return null;

  const handleResend = async () => {
    setPending(true);
    try {
      await resendVerificationEmail();
      toast.success({
        title: 'Verification re-issued',
        description:
          'A fresh verification link has been logged for ops retrieval. Check your application log for "EMAIL VERIFICATION TOKEN ISSUED" until SMTP is wired in.',
      });
    } catch (err) {
      toast.error({
        title: 'Could not re-issue verification',
        description: normalizeError(err),
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      className="flex items-center justify-between gap-3 rounded-md border px-4 py-2.5"
      style={{
        background: 'rgba(245,166,35,0.08)',
        borderColor: 'rgba(245,166,35,0.40)',
      }}
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
          style={{
            background: 'rgba(245,166,35,0.15)',
            color: 'var(--color-warning)',
          }}
        >
          <Mail size={14} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-text-primary">Verify your email</p>
          <p className="truncate text-[13px] text-text-secondary">
            We need to confirm <span className="font-mono">{user.email}</span>. Click the link from
            your verification message — or have your admin pull it from the application log.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleResend}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.14em] text-text-primary transition-colors hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} strokeWidth={2} />}
        Resend
      </button>
    </section>
  );
}
