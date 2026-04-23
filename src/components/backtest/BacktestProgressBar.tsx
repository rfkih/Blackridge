import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BacktestRun } from '@/types/backtest';

interface BacktestProgressBarProps {
  run: Pick<BacktestRun, 'status' | 'progressPercent' | 'errorMessage'>;
  className?: string;
}

/**
 * Live progress indicator for a still-executing backtest.
 *
 * Renders nothing once the run reaches a terminal state — the result page
 * immediately takes over with real charts, so the bar would just add noise.
 * For FAILED runs we surface the error message inline so users don't have
 * to dig through the JSON response to find out why it died.
 */
export function BacktestProgressBar({ run, className }: BacktestProgressBarProps) {
  const status = (run.status ?? 'PENDING').toUpperCase();
  const isPending = status === 'PENDING';
  const isRunning = status === 'RUNNING';
  const isFailed = status === 'FAILED';

  if (!isPending && !isRunning && !isFailed) return null;

  const percent = Math.max(0, Math.min(100, Math.round(run.progressPercent ?? 0)));
  const displayPercent = isFailed ? percent : isPending ? Math.max(percent, 2) : percent;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={isPending || isRunning}
      className={cn(
        'rounded-lg border bg-[var(--bg-surface)] p-4 shadow-panel',
        isFailed ? 'border-[rgba(255,77,106,0.4)]' : 'border-[var(--border-subtle)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {(isPending || isRunning) && (
            <Loader2 size={14} className="animate-spin text-[var(--accent-primary)]" />
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-secondary)]">
            {isPending
              ? 'Queued'
              : isRunning
                ? 'Running backtest'
                : 'Backtest failed'}
          </span>
        </div>
        <span
          className="font-mono text-sm tabular-nums"
          style={{ color: isFailed ? 'var(--color-loss)' : 'var(--text-primary)' }}
        >
          {displayPercent}
          <span className="ml-0.5 text-[10px] text-[var(--text-muted)]">%</span>
        </span>
      </div>

      <div
        className="mt-3 h-[6px] w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--border-subtle)' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${displayPercent}%`,
            background: isFailed
              ? 'var(--color-loss)'
              : 'linear-gradient(90deg, var(--color-profit) 0%, rgba(31, 200, 150, 0.6) 100%)',
            boxShadow: isFailed
              ? 'none'
              : '0 0 12px rgba(31, 200, 150, 0.35)',
          }}
        />
      </div>

      {(isPending || isRunning) && (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          {isPending
            ? 'Waiting for a worker to pick up the run…'
            : 'Iterating candles, running strategies, and persisting trades. Results appear below as soon as the run finishes.'}
        </p>
      )}

      {isFailed && run.errorMessage && (
        <p className="mt-2 truncate text-[11px] text-[var(--color-loss)]" title={run.errorMessage}>
          {run.errorMessage}
        </p>
      )}
    </div>
  );
}
