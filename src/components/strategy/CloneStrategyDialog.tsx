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
import { useActiveAccount } from '@/hooks/useAccounts';
import { normalizeError } from '@/lib/api/client';
import { useCloneStrategy } from '@/hooks/useStrategies';
import { toast } from '@/hooks/useToast';
import type { AccountStrategy } from '@/types/strategy';

/** V54 — confirms cloning a (typically PUBLIC) research-agent strategy into
 *  the caller's account. The clone lands as PRIVATE / disabled / simulated /
 *  STOPPED so the user must explicitly enable it on the strategies page. */
export function CloneStrategyDialog({
  open,
  onOpenChange,
  strategy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: AccountStrategy | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const cloneMutation = useCloneStrategy();

  const { scopedAccountId, activeAccount } = useActiveAccount();

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  if (!strategy) return null;

  const handleClone = () => {
    setError(null);
    cloneMutation.mutate(
      { sourceId: strategy.id, targetAccountId: scopedAccountId ?? undefined },
      {
        onSuccess: () => {
          toast.success({
            title: 'Cloned to your account',
            description: `${strategy.strategyCode} · ${strategy.symbol} ${strategy.interval} — disabled by default. Enable it from the strategies list when ready.`,
          });
          onOpenChange(false);
        },
        onError: (err) => setError(normalizeError(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Clone {strategy.strategyCode} · {strategy.symbol}?
          </DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Copies the preset (parameters, side flags, allocation, risk settings) into your account.
            The clone is private and disabled by default — nothing trades until you explicitly
            enable it.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Source:</span>{' '}
            <span className="text-[var(--text-primary)]">{strategy.ownerLabel}</span>
          </p>
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
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Preset:</span>{' '}
            <span className="text-[var(--text-primary)]">{strategy.presetName}</span>
          </p>
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Destination:</span>{' '}
            <span className="text-[var(--text-primary)]">
              {scopedAccountId && activeAccount ? activeAccount.label : 'Your first account'}
            </span>
          </p>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          If you already have a strategy for this (definition · symbol · interval) on the target
          account, the clone is rejected to avoid duplicates.
        </p>

        {error && (
          <p className="rounded border border-[rgba(229,72,77,0.3)] bg-[rgba(229,72,77,0.08)] px-3 py-2 text-xs text-[var(--color-loss)]">
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
            onClick={handleClone}
            disabled={cloneMutation.isPending}
            className="rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cloneMutation.isPending ? 'Cloning…' : 'Clone to my account'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
