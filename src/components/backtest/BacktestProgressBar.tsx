import { Clock, Loader2 } from 'lucide-react';
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
        isFailed ? 'border-[rgba(229,72,77,0.4)]' : 'border-[var(--border-subtle)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isPending && (
            <Clock size={14} className="shrink-0 text-[var(--color-warning)]" />
          )}
          {isRunning && (
            <Loader2 size={14} className="animate-spin shrink-0 text-[var(--accent-primary)]" />
          )}
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-secondary)]">
            {isPending
              ? 'In Queue'
              : isRunning
                ? 'Running backtest'
                : 'Backtest failed'}
          </span>
        </div>
        <span
          className="font-mono text-sm tabular-nums"
          style={{
            color: isFailed
              ? 'var(--color-loss)'
              : isPending
                ? 'var(--color-warning)'
                : 'var(--text-primary)',
          }}
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
          className={cn(
            'h-full rounded-full transition-[width] duration-700 ease-out',
            isPending && 'animate-pulse',
          )}
          style={{
            width: `${displayPercent}%`,
            background: isFailed
              ? 'var(--color-loss)'
              : isPending
                ? 'var(--color-warning)'
                : 'linear-gradient(90deg, var(--color-profit) 0%, rgba(22,179,100, 0.6) 100%)',
            boxShadow: isFailed || isPending
              ? 'none'
              : '0 0 12px rgba(22,179,100, 0.35)',
          }}
        />
      </div>

      {(isPending || isRunning) && (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          {isPending
            ? 'Queued for execution — this run will start automatically when a slot is free.'
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
