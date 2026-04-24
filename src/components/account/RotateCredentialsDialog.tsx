'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRotateAccountCredentials } from '@/hooks/useAccounts';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import type { AccountSummary } from '@/types/account';

interface RotateCredentialsDialogProps {
  account: AccountSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  apiKey: string;
  apiSecret: string;
  acknowledgedSafety: boolean;
}

const EMPTY_STATE: FormState = {
  apiKey: '',
  apiSecret: '',
  acknowledgedSafety: false,
};

/**
 * Replaces the Binance API key + secret for an already-connected account.
 *
 * <p>Rotation is always a full pair replacement — Binance doesn't allow
 * mutating an existing key in place, so the user always brings a freshly
 * generated pair here. The backend re-encrypts both values at rest.
 */
export function RotateCredentialsDialog({
  account,
  open,
  onOpenChange,
}: RotateCredentialsDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_STATE);
  const [showSecret, setShowSecret] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useRotateAccountCredentials();

  useEffect(() => {
    if (open) {
      setForm(EMPTY_STATE);
      setShowSecret(false);
      setSubmitError(null);
    }
  }, [open]);

  const keyTooShort = form.apiKey.trim().length < 8;
  const secretTooShort = form.apiSecret.trim().length < 8;
  const canSubmit =
    !keyTooShort && !secretTooShort && form.acknowledgedSafety && !mutation.isPending && !!account;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    if (!canSubmit || !account) return;
    setSubmitError(null);
    mutation.mutate(
      {
        accountId: account.id,
        payload: {
          apiKey: form.apiKey.trim(),
          apiSecret: form.apiSecret.trim(),
        },
      },
      {
        onSuccess: (updated) => {
          toast.success({
            title: 'API key rotated',
            description: `${updated.label ?? updated.exchange ?? 'Broker'} credentials replaced.`,
          });
          onOpenChange(false);
        },
        onError: (err) => {
          setSubmitError(normalizeError(err));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-sm"
              style={{
                background: 'var(--accent-glow)',
                color: 'var(--accent-primary)',
              }}
            >
              <KeyRound size={14} strokeWidth={1.75} />
            </span>
            <DialogTitle className="font-display text-lg">Rotate API key</DialogTitle>
          </div>
          <DialogDescription className="text-[var(--text-secondary)]">
            Replace the stored key + secret for{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {account?.label ?? account?.exchange ?? 'this broker'}
            </span>
            . Generate a fresh pair on Binance first — the old pair will stop working immediately
            after you save.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              New API key
            </Label>
            <Input
              id="rotate-api-key"
              value={form.apiKey}
              onChange={(e) => setField('apiKey', e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••••••••••••••"
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-wider"
              aria-invalid={keyTooShort && form.apiKey.length > 0}
            />
            {keyTooShort && form.apiKey.length > 0 && (
              <p role="alert" className="text-[11px] text-[var(--color-loss)]">
                API key looks too short.
              </p>
            )}
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              New API secret
            </Label>
            <div className="relative">
              <Input
                id="rotate-api-secret"
                type={showSecret ? 'text' : 'password'}
                value={form.apiSecret}
                onChange={(e) => setField('apiSecret', e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••••••••••••••"
                autoComplete="off"
                spellCheck={false}
                className="pr-9 font-mono tracking-wider"
                aria-invalid={secretTooShort && form.apiSecret.length > 0}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? 'Hide API secret' : 'Show API secret'}
                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:text-text-secondary"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {secretTooShort && form.apiSecret.length > 0 && (
              <p role="alert" className="text-[11px] text-[var(--color-loss)]">
                API secret looks too short.
              </p>
            )}
          </div>

          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control -- checkbox is nested inside */}
          <label className="col-span-2 flex cursor-pointer items-start gap-2.5 rounded-md border border-bd-subtle bg-bg-elevated p-3 transition-colors hover:bg-bg-hover">
            <input
              type="checkbox"
              checked={form.acknowledgedSafety}
              onChange={(e) => setField('acknowledgedSafety', e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-profit)]"
              aria-label="I have disabled withdrawal permissions on this API key"
            />
            <span className="text-[12px] leading-relaxed text-text-secondary">
              I confirm this new key has{' '}
              <span className="font-semibold text-text-primary">withdrawal disabled</span> and only
              trading / read-only permissions enabled.
            </span>
          </label>

          {submitError && (
            <p
              role="alert"
              className="col-span-2 flex items-start gap-2 rounded-sm border px-3 py-2 text-xs"
              style={{
                borderColor: 'rgba(255,77,106,0.4)',
                backgroundColor: 'rgba(255,77,106,0.08)',
                color: 'var(--color-loss)',
              }}
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="gap-2">
            {mutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Rotating
              </>
            ) : (
              <>
                <ShieldCheck size={14} /> Rotate key
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
