'use client';

import { TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AccountStrategy } from '@/types/strategy';

interface SwitchToLiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: AccountStrategy | null;
  /** True when transitioning from STOPPED (cold start in live). False when flipping a running PAPER row. */
  fromStopped: boolean;
  isPending: boolean;
  onConfirm: (s: AccountStrategy) => void;
}

export function SwitchToLiveDialog({
  open,
  onOpenChange,
  strategy,
  fromStopped,
  isPending,
  onConfirm,
}: SwitchToLiveDialogProps) {
  if (!strategy) return null;

  const headline = fromStopped ? 'Start in LIVE mode?' : 'Switch to LIVE?';
  const intent = fromStopped
    ? 'This preset will begin placing REAL Binance orders on the next closed candle.'
    : 'This preset is currently in paper mode. Switching to LIVE places REAL Binance orders on the next closed candle.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <TrendingUp size={18} style={{ color: 'var(--color-profit)' }} />
            {headline}
          </DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">{intent}</DialogDescription>
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
        </div>

        <p className="rounded border border-[rgba(22,179,100,0.32)] bg-[rgba(22,179,100,0.08)] px-3 py-2 text-xs text-[var(--color-profit)]">
          Real capital is at risk. Confirm you are ready to take live orders.
        </p>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(strategy)}
            disabled={isPending}
            className="rounded-md bg-[var(--color-profit)] px-3 py-1.5 text-xs font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Switching…' : fromStopped ? 'Start LIVE' : 'Switch to LIVE'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
