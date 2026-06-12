'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AccountStrategy } from '@/types/strategy';

interface RearmKillSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: AccountStrategy | null;
  isRearming: boolean;
  onConfirm: (s: AccountStrategy) => void;
}

const REARM_COOLDOWN_MS = 5_000;

export function RearmKillSwitchDialog({
  open,
  onOpenChange,
  strategy,
  isRearming,
  onConfirm,
}: RearmKillSwitchDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(REARM_COOLDOWN_MS / 1000);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(REARM_COOLDOWN_MS / 1000);
    const startedAt = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((REARM_COOLDOWN_MS - (Date.now() - startedAt)) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [open]);

  if (!strategy) return null;

  const reason = strategy.killSwitchReason?.trim() || 'Drawdown kill-switch tripped';
  const trippedLabel = strategy.killSwitchTrippedAt
    ? formatDistanceToNow(new Date(strategy.killSwitchTrippedAt), { addSuffix: true })
    : null;

  const cooldownActive = secondsLeft > 0;
  const disabled = isRearming || cooldownActive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <ShieldAlert size={18} style={{ color: 'var(--color-loss)' }} />
            Re-arm kill-switch?
          </DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            The drawdown kill-switch tripped to halt new entries on this preset. Re-arming clears
            the flag and the strategy resumes trading on the next signal — even if the condition
            that tripped it has not resolved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Preset:</span>{' '}
            <span className="text-[var(--text-primary)]">{strategy.presetName}</span>
          </p>
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Strategy:</span>{' '}
            <span className="text-[var(--text-primary)]">
              {strategy.strategyCode} · {strategy.symbol} · {strategy.interval}
            </span>
          </p>
          <p className="font-mono text-sm">
            <span className="text-[var(--text-muted)]">Tripped:</span>{' '}
            <span className="text-[var(--text-primary)]">{trippedLabel ?? 'unknown time'}</span>
          </p>
          <p className="font-mono text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--text-muted)]">Reason:</span> {reason}
          </p>
        </div>

        <p className="rounded border border-[rgba(229,72,77,0.32)] bg-[rgba(229,72,77,0.08)] px-3 py-2 text-xs text-[var(--color-loss)]">
          Open positions are unaffected — they continue to be managed by their stops. Re-arming only
          clears the block on opening new positions.
        </p>

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
            onClick={() => onConfirm(strategy)}
            disabled={disabled}
            className="rounded-md bg-[var(--color-loss)] px-3 py-1.5 text-xs font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={
              cooldownActive ? `Re-arm available in ${secondsLeft} seconds` : 'Re-arm kill-switch'
            }
          >
            {isRearming
              ? 'Re-arming…'
              : cooldownActive
                ? `Re-arm (${secondsLeft}s)`
                : 'Re-arm kill-switch'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
