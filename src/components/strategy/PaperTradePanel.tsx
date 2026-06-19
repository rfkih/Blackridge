'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  TestTube,
} from 'lucide-react';
import {
  getPaperTrades,
  type PaperTradeRun,
} from '@/lib/api/strategy-promotion';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { formatDate } from '@/lib/formatters';

interface PaperTradePanelProps {
  accountStrategyId: string;
  /** When the strategy is not in PAPER_TRADE state (`simulated=false`),
   *  the panel renders a soft hint instead of the live feed. */
  isPaperTrade: boolean;
}

export function PaperTradePanel({
  accountStrategyId,
  isPaperTrade,
}: PaperTradePanelProps) {
  const isAdmin = useIsAdmin();

  const query = useQuery({
    queryKey: ['paper-trades', accountStrategyId],
    queryFn: () => getPaperTrades(accountStrategyId),
    staleTime: 30_000,
    enabled: isAdmin && Boolean(accountStrategyId),
    retry: 0,
  });

  const summary = useMemo(() => buildSummary(query.data ?? []), [query.data]);

  if (!isAdmin) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-bd-subtle px-4 py-3">
        <h3 className="flex items-center gap-2 font-display text-[14px] font-semibold text-text-primary">
          <TestTube size={13} strokeWidth={1.75} className="text-text-secondary" />
          Paper trades
          <span className="font-mono text-[13px] font-normal text-text-muted">
            simulated decisions captured while {isPaperTrade ? 'in' : 'pre'} PAPER_TRADE
          </span>
        </h3>
        {summary.total > 0 && (
          <span className="font-mono text-[12px] uppercase tracking-widest text-text-muted">
            {summary.total} {summary.total === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex items-center gap-2 px-4 py-6 text-text-secondary">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[14px]">Loading paper-trade history…</span>
        </div>
      ) : query.isError ? (
        <div className="px-4 py-6 text-[14px] text-text-secondary">
          Could not load paper-trade history.
        </div>
      ) : !query.data || query.data.length === 0 ? (
        <div className="px-4 py-6 text-[14px] text-text-secondary">
          {isPaperTrade
            ? 'No paper-trade decisions captured yet. The live executor writes a row here when this strategy fires while simulated=true.'
            : 'This strategy has not yet been in PAPER_TRADE state. Promote it via the /research dashboard to start capturing simulated decisions.'}
        </div>
      ) : (
        <PaperTradeBody rows={query.data} summary={summary} />
      )}
    </section>
  );
}

interface Summary {
  total: number;
  longCount: number;
  shortCount: number;
  byDecision: Record<string, number>;
  lastTime: string | null;
  totalNotionalUsdt: number;
}

function buildSummary(rows: PaperTradeRun[]): Summary {
  let longCount = 0;
  let shortCount = 0;
  let totalNotional = 0;
  const byDecision: Record<string, number> = {};
  for (const r of rows) {
    if (r.side === 'LONG') longCount += 1;
    if (r.side === 'SHORT') shortCount += 1;
    byDecision[r.decisionType] = (byDecision[r.decisionType] ?? 0) + 1;
    const n = num(r.intendedNotionalUsdt);
    if (n != null) totalNotional += Math.abs(n);
  }
  return {
    total: rows.length,
    longCount,
    shortCount,
    byDecision,
    lastTime: rows.length > 0 ? rows[0].createdTime : null,
    totalNotionalUsdt: totalNotional,
  };
}

function PaperTradeBody({
  rows,
  summary,
}: {
  rows: PaperTradeRun[];
  summary: Summary;
}) {
  const decisionMix = Object.entries(summary.byDecision)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="Total" value={summary.total.toLocaleString()} />
        <Stat
          label="Long / Short"
          value={`${summary.longCount} / ${summary.shortCount}`}
          tone={
            summary.longCount > summary.shortCount
              ? 'profit'
              : summary.shortCount > summary.longCount
                ? 'loss'
                : 'neutral'
          }
        />
        <Stat
          label="Notional (sum)"
          value={
            summary.totalNotionalUsdt > 0
              ? `${summary.totalNotionalUsdt.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })} USDT`
              : '—'
          }
        />
        <Stat
          label="Last event"
          value={
            summary.lastTime
              ? formatDate(new Date(summary.lastTime).getTime())
              : '—'
          }
        />
      </div>

      {decisionMix.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[12px] uppercase tracking-widest text-text-muted">
            Decision mix
          </span>
          {decisionMix.map(([k, n]) => (
            <span
              key={k}
              className="rounded-sm bg-bg-hover px-1.5 py-px font-mono text-[12px] text-text-secondary"
            >
              {k} ×{n}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-sm border border-bd-subtle">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-bg-base font-mono text-[12px] uppercase tracking-widest text-text-muted">
            <tr>
              <th className="px-2 py-1.5">Time</th>
              <th className="px-2 py-1.5">Decision</th>
              <th className="px-2 py-1.5">Side</th>
              <th className="px-2 py-1.5 text-right">Price</th>
              <th className="px-2 py-1.5 text-right">Qty</th>
              <th className="px-2 py-1.5 text-right">Notional</th>
              <th className="px-2 py-1.5 text-right">SL</th>
              <th className="px-2 py-1.5 text-right">TP</th>
              <th className="px-2 py-1.5">Skip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bd-subtle font-mono text-text-primary">
            {rows.slice(0, 100).map((r) => (
              <tr key={r.paperTradeId} className="hover:bg-bg-hover/40">
                <td className="px-2 py-1.5 text-text-secondary">
                  {formatDate(new Date(r.createdTime).getTime())}
                </td>
                <td className="px-2 py-1.5 text-text-secondary">
                  {r.decisionType}
                </td>
                <td className="px-2 py-1.5">
                  <SideBadge side={r.side} />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmtNum(r.intendedPrice)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmtNum(r.intendedQuantity)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmtNum(r.intendedNotionalUsdt)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmtNum(r.stopLossPrice)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmtNum(r.takeProfitPrice)}
                </td>
                <td className="px-2 py-1.5 text-text-muted">
                  {r.skipReason ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 && (
          <div className="border-t border-bd-subtle bg-bg-base px-2 py-1.5 font-mono text-[12px] text-text-muted">
            Showing first 100 of {rows.length} rows.
          </div>
        )}
      </div>

      <p className="text-[13px] text-text-muted">
        Paper-trade rows capture only OPEN_LONG / OPEN_SHORT decisions while
        the strategy is simulated. CLOSE_* and position-management decisions
        always execute against real positions and are not diverted.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'profit' | 'loss';
}) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : 'var(--text-primary)';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[12px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span
        className="font-mono tabular-nums text-[14px]"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

function SideBadge({ side }: { side: 'LONG' | 'SHORT' | null }) {
  if (!side) {
    return <span className="text-text-muted">—</span>;
  }
  const isLong = side === 'LONG';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-px font-mono text-[12px] uppercase tracking-widest"
      style={{
        background: isLong ? 'rgba(22,179,100,0.12)' : 'rgba(229,72,77,0.12)',
        color: isLong ? 'var(--color-profit)' : 'var(--color-loss)',
      }}
    >
      {isLong ? (
        <ArrowUp size={10} strokeWidth={2} />
      ) : (
        <ArrowDown size={10} strokeWidth={2} />
      )}
      {side}
    </span>
  );
}

function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(v: number | string | null | undefined): string {
  const n = num(v);
  if (n == null) return '—';
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return n.toFixed(Math.abs(n) >= 1 ? 4 : 6);
}
