'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import { useStrategyRanking } from '@/lib/api/ranking';
import type { StrategyRankRow } from '@/types/ranking';

const WINDOW_OPTIONS = [
  { label: '1Y+', days: 365 },
  { label: '18M+', days: 548 },
  { label: '2Y+', days: 730 },
] as const;

export function StrategyRankingTable() {
  const [minDays, setMinDays] = useState(365);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { data, isLoading, isError } = useStrategyRanking(minDays);

  return (
    <div className="br-card" style={{ padding: 24 }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy size={16} style={{ color: 'var(--color-profit)' }} />
          <h3
            className="font-display"
            style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}
          >
            Strategy ranking
          </h3>
          {data && (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {data.total} strategies
            </span>
          )}
        </div>
        <div className="inline-flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-hover)' }}>
          {WINDOW_OPTIONS.map((o) => (
            <button
              key={o.days}
              type="button"
              onClick={() => setMinDays(o.days)}
              className="rounded-md px-3 py-1 text-[12px] font-semibold transition-colors"
              style={{
                background: minDays === o.days ? 'var(--bg-elevated)' : 'transparent',
                color: minDays === o.days ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Loading rankings…
        </div>
      )}

      {isError && (
        <div className="py-10 text-center text-[13px]" style={{ color: 'var(--color-loss)' }}>
          Could not load rankings — orchestrator may be offline.
        </div>
      )}

      {data && data.rankings.length === 0 && (
        <div className="py-10 text-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          No completed backtests with a {minDays}-day window yet.
        </div>
      )}

      {data && data.rankings.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          {/* header */}
          <div
            className="mb-1 grid px-3 text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{
              gridTemplateColumns: '32px 1fr 80px 52px 96px 84px 80px 72px 60px 24px',
              color: 'var(--text-muted)',
            }}
          >
            <span>#</span>
            <span>Strategy · Symbol · Interval</span>
            <span className="text-right">Ann. Return</span>
            <span className="text-right">Sharpe</span>
            <span className="text-right">Max DD</span>
            <span className="text-right">Trades</span>
            <span className="text-right">Win rate</span>
            <span className="text-right">PF</span>
            <span className="text-center">Verdict</span>
            <span />
          </div>

          {data.rankings.map((row) => {
            const key = `${row.strategyCode}-${row.symbol}-${row.intervalName}`;
            const expanded = expandedRow === key;
            return (
              <RankingRow
                key={key}
                row={row}
                expanded={expanded}
                onToggle={() => setExpandedRow(expanded ? null : key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function RankingRow({
  row,
  expanded,
  onToggle,
}: {
  row: StrategyRankRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ret = row.annualizedReturnPct;
  const retColor =
    ret == null
      ? 'var(--text-muted)'
      : ret >= 10
        ? 'var(--color-profit)'
        : ret >= 0
          ? 'var(--text-primary)'
          : 'var(--color-loss)';

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
        style={{
          gridTemplateColumns: '32px 1fr 80px 52px 96px 84px 80px 72px 60px 24px',
          alignItems: 'center',
          border: 'none',
          background: expanded ? 'var(--bg-hover)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        {/* rank */}
        <span
          className="num text-[13px] font-bold"
          style={{ color: row.rank <= 3 ? 'var(--color-profit)' : 'var(--text-muted)' }}
        >
          {row.rank}
        </span>

        {/* identity */}
        <div style={{ minWidth: 0 }}>
          <div
            className="truncate text-[13px] font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {row.strategyCode}
          </div>
          <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {row.symbol} · {row.intervalName} · {row.windowDays}d
          </div>
        </div>

        {/* ann return */}
        <span className="num text-right text-[13px] font-bold" style={{ color: retColor }}>
          {ret != null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%` : '—'}
        </span>

        {/* sharpe */}
        <span className="num text-right text-[12px]" style={{ color: 'var(--text-primary)' }}>
          {row.sharpeAnnualized != null ? row.sharpeAnnualized.toFixed(2) : '—'}
        </span>

        {/* max dd */}
        <span className="num text-right text-[12px]" style={{ color: 'var(--color-loss)' }}>
          {row.maxDrawdownPct != null ? `-${Math.abs(row.maxDrawdownPct).toFixed(1)}%` : '—'}
        </span>

        {/* n trades */}
        <span className="num text-right text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {row.nTrades ?? '—'}
        </span>

        {/* win rate */}
        <span className="num text-right text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {row.winRate != null ? `${(row.winRate * 100).toFixed(1)}%` : '—'}
        </span>

        {/* profit factor */}
        <span className="num text-right text-[12px]" style={{ color: 'var(--text-muted)' }}>
          {row.profitFactor != null ? row.profitFactor.toFixed(2) : '—'}
        </span>

        {/* verdict pill */}
        <span className="text-center">
          <VerdictPill verdict={row.verdict} />
        </span>

        {/* chevron */}
        <span style={{ color: 'var(--text-muted)', display: 'flex', justifyContent: 'center' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && <ParamsPanel row={row} />}
    </>
  );
}

function ParamsPanel({ row }: { row: StrategyRankRow }) {
  const entries = Object.entries(row.params);

  return (
    <div
      className="mx-2 mb-2 rounded-lg px-4 py-3"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: 'var(--text-muted)' }}
      >
        Parameters — {row.strategyCode} ({row.symbol} {row.intervalName})
      </div>

      {entries.length === 0 ? (
        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          No params snapshot available for this run.
        </span>
      ) : (
        <div
          className="grid gap-x-6 gap-y-1"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
        >
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <span
                className="font-mono text-[11px]"
                style={{ color: 'var(--text-muted)', flexShrink: 0 }}
              >
                {k}
              </span>
              <span
                className="num truncate text-[12px] font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-3 flex flex-wrap gap-4 pt-3 text-[11px]"
        style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
      >
        <span>
          DSR{' '}
          <span className="num font-semibold" style={{ color: 'var(--text-primary)' }}>
            {row.dsr != null ? row.dsr.toFixed(3) : '—'}
          </span>
        </span>
        <span>
          PSR{' '}
          <span className="num font-semibold" style={{ color: 'var(--text-primary)' }}>
            {row.psr != null ? row.psr.toFixed(3) : '—'}
          </span>
        </span>
        <span>
          Window{' '}
          <span className="num font-semibold" style={{ color: 'var(--text-primary)' }}>
            {row.windowDays}d
          </span>
        </span>
        <span>
          Capital{' '}
          <span className="num font-semibold" style={{ color: 'var(--text-primary)' }}>
            {row.initialCapital != null ? `$${row.initialCapital.toLocaleString()}` : '—'}
          </span>
        </span>
        <span
          style={{
            color:
              row.statisticalVerdict === 'SIGNIFICANT_EDGE'
                ? 'var(--color-profit)'
                : 'var(--text-muted)',
          }}
        >
          {row.statisticalVerdict ?? 'NOT_TESTED'}
        </span>
      </div>
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: StrategyRankRow['verdict'] }) {
  const cfg = {
    PASS: { bg: 'rgba(34,197,94,0.15)', color: 'var(--color-profit)', label: 'PASS' },
    ITERATE: { bg: 'rgba(250,204,21,0.15)', color: '#facc15', label: 'ITER' },
    DISCARD: { bg: 'rgba(239,68,68,0.12)', color: 'var(--color-loss)', label: 'DISC' },
    FAILED: { bg: 'rgba(239,68,68,0.12)', color: 'var(--color-loss)', label: 'FAIL' },
  }[verdict] ?? { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', label: verdict };

  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}
