'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { normalizeError } from '@/lib/api/client';
import { useDeleteStrategy } from '@/hooks/useStrategies';
import { toast } from '@/hooks/useToast';
import type { AccountStrategy } from '@/types/strategy';

interface DeleteStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: AccountStrategy | null;
}

export function DeleteStrategyDialog({ open, onOpenChange, strategy }: DeleteStrategyDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const deleteMutation = useDeleteStrategy();

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  if (!strategy) return null;

  const handleDelete = () => {
    setError(null);
    deleteMutation.mutate(strategy.id, {
      onSuccess: () => {
        toast.success({
          title: 'Strategy deleted',
          description: `${strategy.strategyCode} · ${strategy.symbol} ${strategy.interval}. Historical trades and P&L remain available.`,
        });
        onOpenChange(false);
      },
      onError: (err) => setError(normalizeError(err)),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Delete strategy?</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            This soft-deletes the strategy — it stops running and disappears from the list, but
            historical trades and P&L remain intact.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Strategy:</span>{' '}
            <span className="text-[var(--text-primary)]">{strategy.strategyCode}</span>
          </p>
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Symbol:</span>{' '}
            <span className="text-[var(--text-primary)]">
              {strategy.symbol} · {strategy.interval}
            </span>
          </p>
        </div>

        <p className="text-xs text-[var(--color-warning)]">
          Deletion is blocked if the strategy has any open trades. Close positions first.
        </p>

        {error && (
          <p className="rounded border border-[rgba(255,77,106,0.3)] bg-[rgba(255,77,106,0.08)] px-3 py-2 text-xs text-[var(--color-loss)]">
            {error}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="rounded-md bg-[var(--color-loss)] px-3 py-1.5 text-xs font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete strategy'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
