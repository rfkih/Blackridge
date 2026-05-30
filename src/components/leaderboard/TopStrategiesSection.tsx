'use client';

import { useState } from 'react';
import { ChevronDown, Rocket, Trophy } from 'lucide-react';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types/leaderboard';

interface TopStrategiesSectionProps {
  entries: LeaderboardEntry[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onDeploy: (entry: LeaderboardEntry) => void;
  /** Disables every deploy button while a deploy is in flight. */
  deployDisabled?: boolean;
}

const VERDICT_ROBUST = 'ROBUST';

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return '—';
  return `${v.toFixed(digits)}%`;
}

function fmtNum(v: number | null, digits = 2): string {
  if (v == null) return '—';
  return v.toFixed(digits);
}

function fmtParamValue(v: unknown): string {
  if (typeof v === 'number')
    return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  return String(v);
}

export function TopStrategiesSection({
  entries,
  isLoading,
  isError,
  onRetry,
  onDeploy,
  deployDisabled,
}: TopStrategiesSectionProps) {
  if (isError) {
    return (
      <EmptyState
        title="Could not load the leaderboard"
        description="The top-strategies endpoint returned an error."
        action={
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No ranked strategies yet"
        description="Strategies appear here once they clear the approval gate with enough evidence (≥30 trades, walk-forward not insufficient)."
      />
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <LeaderboardRow
          key={`${entry.symbol}::${entry.strategyCode}::${entry.interval}`}
          entry={entry}
          onDeploy={onDeploy}
          deployDisabled={deployDisabled}
        />
      ))}
    </div>
  );
}

function LeaderboardRow({
  entry,
  onDeploy,
  deployDisabled,
}: {
  entry: LeaderboardEntry;
  onDeploy: (entry: LeaderboardEntry) => void;
  deployDisabled?: boolean;
}) {
  const [paramsOpen, setParamsOpen] = useState(false);
  const isRobust = entry.walkForwardVerdict === VERDICT_ROBUST;
  const paramEntries = Object.entries(entry.bestParams);

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-panel transition-colors hover:border-[var(--border-default)]">
      <div className="flex flex-wrap items-start gap-4">
        {/* Rank */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-lg font-bold tabular-nums"
          style={{
            color: entry.rank <= 3 ? 'var(--color-profit)' : 'var(--text-secondary)',
            backgroundColor: entry.rank <= 3 ? 'rgba(22,179,100,0.12)' : 'var(--bg-elevated)',
          }}
        >
          {entry.rank}
        </div>

        {/* Identity + metrics */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StrategyBadge code={entry.strategyCode} size="sm" />
            <span className="font-display text-base font-bold tracking-tight text-[var(--text-primary)]">
              {entry.symbol}
            </span>
            <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
              {entry.interval}
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{
                color: isRobust ? 'var(--color-profit)' : 'var(--text-muted)',
                backgroundColor: isRobust ? 'rgba(22,179,100,0.12)' : 'var(--bg-elevated)',
              }}
              title="Latest walk-forward stability verdict"
            >
              {entry.walkForwardVerdict ?? 'NO WALK-FWD'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
            <Metric label="CAGR" value={fmtPct(entry.cagrPct)} tone="profit" />
            <Metric label="Max DD" value={fmtPct(entry.maxDrawdownPct)} tone="loss" />
            <Metric label="PSR" value={fmtNum(entry.psr, 3)} />
            <Metric label="Profit factor" value={fmtNum(entry.profitFactor)} />
            <Metric label="Trades" value={String(entry.trades)} />
          </div>
        </div>

        {/* Score + deploy */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Score
            </div>
            <div className="font-mono text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {entry.score.toFixed(1)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDeploy(entry)}
            disabled={deployDisabled}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-profit)] px-3 py-1.5 text-xs font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Rocket size={13} />
            Deploy
          </button>
        </div>
      </div>

      {/* Best params */}
      {paramEntries.length > 0 && (
        <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
          <button
            type="button"
            onClick={() => setParamsOpen((o) => !o)}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            aria-expanded={paramsOpen}
          >
            <ChevronDown
              size={13}
              className={cn('transition-transform', paramsOpen && 'rotate-180')}
            />
            {paramsOpen ? 'Hide' : 'Show'} best parameters · {paramEntries.length}
          </button>
          {paramsOpen && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {paramEntries.map(([k, v]) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px]"
                >
                  <span className="text-[var(--text-muted)]">{k}</span>
                  <span className="tabular-nums text-[var(--text-primary)]">
                    {fmtParamValue(v)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
}) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
