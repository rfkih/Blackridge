'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil } from 'lucide-react';
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
import { useUpdateAccount } from '@/hooks/useAccounts';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import type { AccountSummary } from '@/types/account';

interface EditAccountDialogProps {
  account: AccountSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EXCHANGE_OPTIONS = [
  { value: 'BNC', label: 'Binance Spot' },
];

const USERNAME_PATTERN = /^[A-Za-z0-9 _-]+$/;

/**
 * Rename + change exchange for an existing account. Credentials are NOT
 * editable here - that flow is `RotateCredentialsDialog` so the audit trail
 * for credential changes stays distinct from cosmetic edits.
 */
export function EditAccountDialog({ account, open, onOpenChange }: EditAccountDialogProps) {
  const [username, setUsername] = useState(account.label);
  const [exchange, setExchange] = useState(account.exchange);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useUpdateAccount();

  useEffect(() => {
    if (open) {
      setUsername(account.label);
      setExchange(account.exchange);
      setTouched(false);
      setSubmitError(null);
    }
  }, [open, account.label, account.exchange]);

  const trimmed = username.trim();
  const usernameError = useMemo(() => {
    if (trimmed.length < 2) return 'At least 2 characters.';
    if (trimmed.length > 50) return 'Max 50 characters.';
    if (!USERNAME_PATTERN.test(trimmed)) return 'Letters, digits, spaces, _ and - only.';
    return null;
  }, [trimmed]);

  const dirty = trimmed !== account.label || exchange !== account.exchange;
  const canSubmit = !usernameError && dirty && !mutation.isPending;

  const handleSubmit = () => {
    setTouched(true);
    if (!canSubmit) return;
    setSubmitError(null);
    mutation.mutate(
      {
        accountId: account.id,
        payload: {
          ...(trimmed !== account.label ? { username: trimmed } : {}),
          ...(exchange !== account.exchange ? { exchange } : {}),
        },
      },
      {
        onSuccess: (next: AccountSummary) => {
          toast.success({
            title: 'Account updated',
            description: `${next.label} · ${next.exchange}`,
          });
          onOpenChange(false);
        },
        onError: (err: unknown) => setSubmitError(normalizeError(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-sm"
              style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)' }}
            >
              <Pencil size={14} strokeWidth={1.75} />
            </span>
            <DialogTitle className="font-display text-lg">Edit account</DialogTitle>
          </div>
          <DialogDescription className="text-[var(--text-secondary)]">
            Rename the label or change the exchange. To rotate credentials, use the dedicated rotate
            button.
          </DialogDescription>
        </DialogHeader>

        <div
          className="grid grid-cols-2 gap-4"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        >
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              Label
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={50}
              autoComplete="off"
              aria-invalid={Boolean(touched && usernameError)}
              autoFocus
            />
            {touched && usernameError ? (
              <p role="alert" className="text-[11px] text-[var(--color-loss)]">
                {usernameError}
              </p>
            ) : null}
          </div>

          <div className="col-span-2 flex flex-col gap-1.5">
            <Label className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              Exchange
            </Label>
            <Select value={exchange} onValueChange={setExchange}>
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
          </div>

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

          <DialogFooter className="col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
