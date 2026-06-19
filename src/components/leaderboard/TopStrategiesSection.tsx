'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, Rocket, Trophy } from 'lucide-react';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { KindBadge } from '@/components/leaderboard/KindBadge';
import { cn } from '@/lib/utils';
import { isHedging } from '@/lib/strategyKind';
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
/** forecast_reconciliation verdicts that warrant a drift badge (OK / INSUFFICIENT / NO_FORECAST don't). */
const DRIFT_ALERTING = new Set(['WARN', 'CRITICAL']);

function fmtPct(v: number | null, digits = 1): string {
  if (v == null) return '—';
  return `${v.toFixed(digits)}%`;
}

function fmtAsOf(iso: string | null): string | null {
  if (!iso) return null;
  // The server emits a zoneless LocalDateTime on the UTC clock. Without a zone,
  // `new Date(iso)` parses as client-local — skewing "ago" by the client's offset.
  // Pin it to UTC by appending 'Z' when no offset/zone is present.
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return null;
  return `${formatDistanceToNow(d)} ago`;
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

  const asOf = fmtAsOf(entries[0]?.computedAt ?? null);

  // Display-grouping only — every returned row is still rendered, and within-group
  // order is the backend's order. Trading rows are ranked by Conviction; hedging
  // tilts are ranked by Calmar (return ÷ drawdown). The two metrics are not
  // comparable, so they get separate sections rather than one interleaved column.
  const tradingEntries = entries.filter((e) => !isHedging(e.strategyKind));
  const hedgingEntries = entries.filter((e) => isHedging(e.strategyKind));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Ranked by Conviction
        </span>
        {asOf && (
          <span
            className="font-mono text-[12px] text-[var(--text-muted)]"
            title="When the leaderboard snapshot was last recomputed (server clock)"
          >
            as of {asOf}
          </span>
        )}
      </div>
      {tradingEntries.map((entry) => (
        <LeaderboardRow
          key={`${entry.symbol}::${entry.strategyCode}::${entry.interval}`}
          entry={entry}
          onDeploy={onDeploy}
          deployDisabled={deployDisabled}
        />
      ))}

      {hedgingEntries.length > 0 && (
        <>
          <div className="px-1 pt-2">
            <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--color-btc)]">
              Hedging · ranked by Calmar
            </span>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Allocation tilts judged on return ÷ drawdown, not Conviction — shown separately so the
              two yardsticks aren&apos;t compared against each other.
            </p>
          </div>
          {hedgingEntries.map((entry) => (
            <LeaderboardRow
              key={`${entry.symbol}::${entry.strategyCode}::${entry.interval}`}
              entry={entry}
              onDeploy={onDeploy}
              deployDisabled={deployDisabled}
            />
          ))}
        </>
      )}
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
  const hasDrift = entry.driftStatus != null && DRIFT_ALERTING.has(entry.driftStatus);
  const hasCapacity = entry.capacityTier != null && entry.capacityTier !== 'UNKNOWN';
  const capacityColor =
    entry.capacityTier === 'REJECT'
      ? 'var(--color-loss)'
      : entry.capacityTier === 'CONCERN'
        ? 'var(--text-secondary)'
        : 'var(--color-profit)';
  const isLive = (entry.nLive ?? 0) > 0;
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
            <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[13px] text-[var(--text-muted)]">
              {entry.interval}
            </span>
            {isLive ? (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: 'var(--color-profit)', backgroundColor: 'rgba(22,179,100,0.12)' }}
                title={`Production — real-capital live (${entry.nLive} closed trades pooled)`}
              >
                live
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
                title="Research graduate — no real-capital deployment yet"
              >
                research
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-[0.1em]"
              style={{
                color: isRobust ? 'var(--color-profit)' : 'var(--text-muted)',
                backgroundColor: isRobust ? 'rgba(22,179,100,0.12)' : 'var(--bg-elevated)',
              }}
              title="Latest walk-forward stability verdict"
            >
              {entry.walkForwardVerdict ?? 'NO WALK-FWD'}
            </span>
            {hasDrift && (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: 'var(--color-loss)', backgroundColor: 'rgba(229,72,77,0.12)' }}
                title="Live performance is drifting from the walk-forward forecast (advisory — not yet in the Conviction score)"
              >
                drift: {entry.driftStatus?.replace(/_/g, ' ')}
              </span>
            )}
            {hasCapacity && (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: capacityColor, backgroundColor: 'var(--bg-elevated)' }}
                title="Capacity-judge verdict — how much edge survives to deployable capital (advisory — not yet in the Conviction score)"
              >
                cap: {entry.capacityTier}
              </span>
            )}
            {entry.nearSubstitute && (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: 'var(--color-loss)', backgroundColor: 'rgba(229,72,77,0.12)' }}
                title={`Near-substitute — highly correlated with a strategy you already run${
                  entry.corrToBook != null ? ` (r=${entry.corrToBook.toFixed(2)})` : ''
                }`}
              >
                ≈ in book
              </span>
            )}
            <KindBadge strategyKind={entry.strategyKind} />
          </div>

          {hedging ? (
            /* Hedging view: Return + Max DD + Calmar are the meaningful yardsticks.
               DSR / Profit-factor / trade-count are not applicable to allocation tilts. */
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <Metric label="Ann. Return" value={fmtPct(entry.cagrPct)} tone="profit" />
              <Metric label="Max DD" value={fmtPct(entry.maxDrawdownPct)} tone="loss" />
              <Metric
                label="Calmar"
                value={fmtNum(entry.calmar)}
                title="Return ÷ Max Drawdown — the primary ranking metric for hedging strategies"
              />
              <Metric label="Trades" value={String(entry.trades)} title="Rebalance events" />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-6">
              <Metric label="DSR" value={fmtNum(entry.deflatedSharpe, 3)} tone="profit" />
              <Metric label="CAGR" value={fmtPct(entry.cagrPct)} tone="profit" />
              <Metric label="Max DD" value={fmtPct(entry.maxDrawdownPct)} tone="loss" />
              <Metric label="Calmar" value={fmtNum(entry.calmar)} />
              <Metric label="Profit factor" value={fmtNum(entry.profitFactor)} />
              <Metric label="Trades" value={String(entry.trades)} />
            </div>
          )}
        </div>

        {/* Score + deploy */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <div
              className="font-mono text-[12px] uppercase tracking-[0.1em] text-[var(--text-muted)]"
              title="Conviction = EdgeLB × Robustness × Live × Capacity, in [0,1]. Deflated, OOS-anchored."
            >
              Conviction
            </div>
            <div className="font-mono text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {entry.score.toFixed(2)}
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
            className="inline-flex items-center gap-1 font-mono text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
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
                  className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[12px]"
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
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
