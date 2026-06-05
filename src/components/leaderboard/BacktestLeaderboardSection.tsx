'use client';

import { useState } from 'react';
import { ShieldCheck, Trophy } from 'lucide-react';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { ParamsPopover } from '@/components/leaderboard/ParamsPopover';
import {
  RequestApprovalDialog,
  type ApprovalTarget,
} from '@/components/leaderboard/RequestApprovalDialog';
import { VerdictBadge } from '@/components/leaderboard/VerdictBadge';
import { KindBadge } from '@/components/leaderboard/KindBadge';
import { isHedging } from '@/lib/strategyKind';
import type { BacktestLeaderboardEntry } from '@/types/leaderboardBacktest';

interface BacktestLeaderboardSectionProps {
  entries: BacktestLeaderboardEntry[];
  /** Total qualifying (symbol × interval × strategy) cells — the survivorship denominator. */
  qualifyingCells: number;
  /** Rows actually shown (= entries.length, passed through from the page payload). */
  shown: number;
  /** HEDGING candidates — a SEPARATE Calmar-ranked list (own denominator). */
  hedgingEntries?: BacktestLeaderboardEntry[];
  hedgingQualifyingCells?: number;
  hedgingShown?: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return '—';
  return `${v.toFixed(digits)}%`;
}

function fmtNum(v: number | null, digits = 2): string {
  if (v == null) return '—';
  return v.toFixed(digits);
}

function fmtSpan(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return '—';
  return `${(days / 365).toFixed(1)}y`;
}

export function BacktestLeaderboardSection({
  entries,
  qualifyingCells,
  shown,
  hedgingEntries = [],
  hedgingQualifyingCells = 0,
  hedgingShown = 0,
  isLoading,
  isError,
  onRetry,
}: BacktestLeaderboardSectionProps) {
  const [target, setTarget] = useState<ApprovalTarget | null>(null);
  const makeApprovalTarget = (entry: BacktestLeaderboardEntry) => () =>
    setTarget({
      symbol: entry.symbol,
      strategyCode: entry.strategyCode,
      interval: entry.interval,
      backtestRunId: entry.backtestRunId,
      params: entry.bestParams,
    });

  if (isError) {
    return (
      <EmptyState
        title="Could not load backtest candidates"
        description="The backtest-leaderboard endpoint returned an error."
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
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (entries.length === 0 && hedgingEntries.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No backtest candidates yet"
        description="The best backtest run per (symbol, strategy, interval) cell appears here once runs exist."
      />
    );
  }

  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <>
          <div className="px-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Showing top {shown} of {qualifyingCells} qualifying cells · candidates (not deployable)
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              One most-recent run per (symbol × interval × strategy) · ≥100 trades · ≥2y data window ·
              ordered by deflated Sharpe.
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              Deflated Sharpe for older runs may understate trial multiplicity until the analyzer
              backfill runs.
            </p>
          </div>

          {entries.map((entry) => (
            <BacktestRow
              key={`${entry.symbol}::${entry.strategyCode}::${entry.interval}::${entry.backtestRunId}`}
              entry={entry}
              onRequestApproval={makeApprovalTarget(entry)}
            />
          ))}
        </>
      )}

      {hedgingEntries.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="px-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-btc)]">
              Hedging candidates · top {hedgingShown} of {hedgingQualifyingCells} cells
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Allocation tilts, ranked by Calmar (return ÷ |max drawdown|). Exempt from the
              trade-count floor — low turnover is the mechanism, so DSR / PF / trade-count do not
              apply. Listed separately because Calmar and deflated Sharpe are not comparable.
            </p>
          </div>

          {hedgingEntries.map((entry) => (
            <BacktestRow
              key={`${entry.symbol}::${entry.strategyCode}::${entry.interval}::${entry.backtestRunId}`}
              entry={entry}
              onRequestApproval={makeApprovalTarget(entry)}
            />
          ))}
        </div>
      )}

      <RequestApprovalDialog
        open={target != null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        target={target}
      />
    </div>
  );
}

function BacktestRow({
  entry,
  onRequestApproval,
}: {
  entry: BacktestLeaderboardEntry;
  onRequestApproval: () => void;
}) {
  const hedging = isHedging(entry.strategyKind);

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
              {entry.interval || '—'}
            </span>
            <VerdictBadge verdict={entry.walkForwardVerdict} />
            <KindBadge strategyKind={entry.strategyKind} />
            {entry.runCreatedAt && (
              <span
                className="font-mono text-[10px] text-[var(--text-muted)]"
                title="When this run was created. It's the most-recent run in its cell with a scored DSR — a newer unscored run may exist."
              >
                run {entry.runCreatedAt.replace('T', ' ').slice(0, 16)}
              </span>
            )}
          </div>

          {hedging ? (
            /* Hedging: surface Return + Max DD + Calmar. DSR/PF/trades are not
               applicable to allocation tilts — rank is by Calmar. */
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <Metric label="Ann. Return" value={fmtPct(entry.cagrPct)} tone="profit" />
              <Metric label="Max DD" value={fmtPct(entry.maxDrawdownPct)} tone="loss" />
              <Metric
                label="Calmar"
                value={
                  entry.cagrPct != null && entry.maxDrawdownPct != null && entry.maxDrawdownPct !== 0
                    ? fmtNum(entry.cagrPct / Math.abs(entry.maxDrawdownPct))
                    : '—'
                }
                title="Return ÷ |Max Drawdown| — primary ranking metric for hedging strategies"
              />
              <Metric
                label="Span"
                value={fmtSpan(entry.spanDays)}
                title={
                  entry.dataStart && entry.dataEnd
                    ? `${entry.dataStart} → ${entry.dataEnd}`
                    : 'Backtest window length'
                }
              />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
              <Metric label="CAGR" value={fmtPct(entry.cagrPct)} tone="profit" />
              <Metric label="DSR" value={fmtNum(entry.deflatedSharpe, 3)} />
              <Metric label="PSR" value={fmtNum(entry.psr, 3)} />
              <Metric label="PF" value={fmtNum(entry.profitFactor)} />
              <Metric label="Trades" value={String(entry.trades)} />
              <Metric
                label="Span"
                value={fmtSpan(entry.spanDays)}
                title={
                  entry.dataStart && entry.dataEnd
                    ? `${entry.dataStart} → ${entry.dataEnd}`
                    : 'Backtest window length'
                }
              />
              <Metric
                label="Trials"
                value={entry.dsrNTrials != null ? String(entry.dsrNTrials) : '—'}
                title="best of N sweep trials"
              />
              <Metric label="Max DD" value={fmtPct(entry.maxDrawdownPct)} tone="loss" />
            </div>
          )}
        </div>

        {/* Request approval */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={onRequestApproval}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            <ShieldCheck size={13} />
            Request approval
          </button>
        </div>
      </div>

      {/* Best params */}
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
        <ParamsPopover params={entry.bestParams} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone?: 'profit' | 'loss';
  title?: string;
}) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div title={title}>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
