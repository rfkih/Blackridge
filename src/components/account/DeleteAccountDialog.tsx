'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
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
import { useDeleteAccount } from '@/hooks/useAccounts';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import type { AccountSummary } from '@/types/account';

interface DeleteAccountDialogProps {
  account: AccountSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirm + soft-delete. Requires the user to type the account label
 * verbatim - guards against fat-finger deletes of the wrong account row.
 *
 * Backend refuses (4xx) when there are open trades; that error flows through
 * normalizeError into the inline alert. We do NOT bypass the server check
 * client-side - the user might have stale data and the server is the
 * authority.
 */
export function DeleteAccountDialog({ account, open, onOpenChange }: DeleteAccountDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const mutation = useDeleteAccount();

  useEffect(() => {
    if (open) {
      setConfirmText('');
      setSubmitError(null);
    }
  }, [open]);

  const matchesLabel = confirmText.trim() === account.label;
  const canDelete = matchesLabel && !mutation.isPending;

  const handleDelete = () => {
    if (!canDelete) return;
    setSubmitError(null);
    mutation.mutate(account.id, {
      onSuccess: () => {
        toast.success({
          title: 'Account removed',
          description: `${account.label} is no longer connected.`,
        });
        onOpenChange(false);
      },
      onError: (err: unknown) => setSubmitError(normalizeError(err)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-sm"
              style={{
                background: 'rgba(255,77,106,0.15)',
                color: 'var(--color-loss)',
              }}
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </span>
            <DialogTitle className="font-display text-lg">Remove account?</DialogTitle>
          </div>
          <DialogDescription className="text-[var(--text-secondary)]">
            This soft-deletes{' '}
            <span className="font-semibold text-text-primary">{account.label}</span> (
            <span className="font-mono">{account.exchange}</span>). Historical trades and P&amp;L
            stay intact for reporting, but no new strategies can run on this account.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-bd-subtle bg-bg-elevated p-3">
          <p className="text-[11px] leading-relaxed text-text-secondary">
            Removal is blocked while open trades reference this account. Close them first if the
            server rejects this action.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="delete-confirm"
            className="text-[10px] uppercase tracking-[0.18em] text-text-secondary"
          >
            Type <span className="font-mono text-text-primary">{account.label}</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={account.label}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        </div>

        {submitError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-sm border px-3 py-2 text-xs"
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
            className="gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Removing
              </>
            ) : (
              <>
                <Trash2 size={14} /> Remove account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
