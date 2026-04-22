'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, Info, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCreateAccount } from '@/hooks/useAccounts';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface NewAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Three-letter exchange codes mirror the backend `accounts.exchange`
 * CHAR(3) column. Keeping a static list (rather than fetching) so the user
 * sees the options instantly and the form stays synchronous.
 */
const EXCHANGE_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: 'BIN', label: 'Binance Spot', description: 'Spot trading — one position per symbol' },
  {
    value: 'BIF',
    label: 'Binance Futures (USD-M)',
    description: 'USD-margined perpetuals — long/short, leverage',
  },
];

interface FormState {
  username: string;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  acknowledgedSafety: boolean;
}

const EMPTY_STATE: FormState = {
  username: '',
  exchange: 'BIN',
  apiKey: '',
  apiSecret: '',
  acknowledgedSafety: false,
};

// Username regex matches the backend's @Pattern on CreateAccountRequest.
const USERNAME_PATTERN = /^[A-Za-z0-9 _-]+$/;

export function NewAccountDialog({ open, onOpenChange }: NewAccountDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_STATE);
  const [showSecret, setShowSecret] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useCreateAccount();

  // Reset form every time the dialog opens so stale values + error state
  // from a prior attempt don't bleed into the new one.
  useEffect(() => {
    if (open) {
      setForm(EMPTY_STATE);
      setShowSecret(false);
      setSubmitError(null);
    }
  }, [open]);

  const trimmedUsername = form.username.trim();
  const validationErrors = useMemo(() => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (trimmedUsername.length < 2) errs.username = 'At least 2 characters.';
    else if (trimmedUsername.length > 50) errs.username = 'Max 50 characters.';
    else if (!USERNAME_PATTERN.test(trimmedUsername))
      errs.username = 'Letters, digits, spaces, _ and - only.';
    if (form.apiKey.trim().length < 8) errs.apiKey = 'API key looks too short.';
    if (form.apiSecret.trim().length < 8) errs.apiSecret = 'API secret looks too short.';
    return errs;
  }, [trimmedUsername, form.apiKey, form.apiSecret]);

  const canSubmit =
    Object.keys(validationErrors).length === 0 && form.acknowledgedSafety && !mutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitError(null);
    mutation.mutate(
      {
        username: trimmedUsername,
        exchange: form.exchange,
        apiKey: form.apiKey.trim(),
        apiSecret: form.apiSecret.trim(),
      },
      {
        onSuccess: (account) => {
          toast.success({
            title: 'Account connected',
            description: `${account.label} · ${account.exchange}`,
          });
          onOpenChange(false);
        },
        onError: (err) => {
          setSubmitError(normalizeError(err));
        },
      },
    );
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
            <DialogTitle className="font-display text-lg">Connect exchange account</DialogTitle>
          </div>
          <DialogDescription className="text-[var(--text-secondary)]">
            Paste a Binance API key and secret to let Meridian Edge place and monitor trades on your
            behalf.
          </DialogDescription>
        </DialogHeader>

        <SafetyBanner />

        <div className="grid grid-cols-2 gap-4">
          {/* Label */}
          <FieldRow
            label="Label"
            error={validationErrors.username}
            hint="Shown in the account switcher. Keep it short — e.g. ‘Main’ or ‘Perp scalp’."
            className="col-span-2"
          >
            <Input
              id="account-label"
              value={form.username}
              onChange={(e) => setField('username', e.target.value)}
              placeholder="Main"
              maxLength={50}
              autoComplete="off"
              aria-invalid={Boolean(validationErrors.username)}
            />
          </FieldRow>

          {/* Exchange */}
          <FieldRow
            label="Exchange"
            hint={EXCHANGE_OPTIONS.find((o) => o.value === form.exchange)?.description}
            className="col-span-2"
          >
            <Select value={form.exchange} onValueChange={(v) => setField('exchange', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXCHANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}{' '}
                    <span className="ml-1 font-mono text-[10px] text-[var(--text-muted)]">
                      {o.value}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* API key */}
          <FieldRow label="API key" error={validationErrors.apiKey} className="col-span-2">
            <Input
              id="account-api-key"
              value={form.apiKey}
              onChange={(e) => setField('apiKey', e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••••••••••••••"
              autoComplete="off"
              spellCheck={false}
              className="font-mono tracking-wider"
              aria-invalid={Boolean(validationErrors.apiKey)}
            />
          </FieldRow>

          {/* API secret */}
          <FieldRow label="API secret" error={validationErrors.apiSecret} className="col-span-2">
            <div className="relative">
              <Input
                id="account-api-secret"
                type={showSecret ? 'text' : 'password'}
                value={form.apiSecret}
                onChange={(e) => setField('apiSecret', e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••••••••••••••"
                autoComplete="off"
                spellCheck={false}
                className="pr-9 font-mono tracking-wider"
                aria-invalid={Boolean(validationErrors.apiSecret)}
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
          </FieldRow>

          {/* Safety acknowledgement */}
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
              I confirm this API key has{' '}
              <span className="font-semibold text-text-primary">withdrawal disabled</span>. Only
              trading and read-only permissions should be enabled.
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
                <Loader2 size={14} className="animate-spin" /> Connecting
              </>
            ) : (
              <>
                <ShieldCheck size={14} /> Connect account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function FieldRow({ label, error, hint, className, children }: FieldRowProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] text-[var(--color-loss)]">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Always-visible safety banner. Exchange API keys are the most sensitive
 * thing a trading platform ever handles — the banner is dense on intent so
 * a cautious user has all the context they need without going elsewhere.
 */
function SafetyBanner() {
  return (
    <div
      className="flex items-start gap-2.5 rounded-md border border-bd-subtle bg-bg-elevated p-3"
      style={{ borderColor: 'rgba(78,158,255,0.35)' }}
    >
      <Info
        size={14}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-[var(--color-info)]"
        aria-hidden="true"
      />
      <div className="text-[11px] leading-relaxed text-text-secondary">
        <p className="font-semibold text-text-primary">How to generate a safe API key</p>
        <ol className="mt-1 list-decimal pl-4">
          <li>Sign in to Binance → API Management → Create API.</li>
          <li>
            Permissions: <span className="text-[var(--color-profit)]">Enable Reading</span> +{' '}
            <span className="text-[var(--color-profit)]">Enable Spot & Margin Trading</span> (or
            Futures if applicable).{' '}
            <span className="text-[var(--color-loss)]">Disable Withdrawals</span>.
          </li>
          <li>Optionally restrict to your server&apos;s IP for extra safety.</li>
          <li>Paste the key + secret below. We never display them again.</li>
        </ol>
      </div>
    </div>
  );
}
