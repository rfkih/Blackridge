'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '@/lib/formatters';
import type { ChartTooltipItem } from '@/lib/charts/rechartsTheme';
import { PanelEmptyState, PanelShell } from './PanelShell';

/** A drawdown sample — negative-or-zero percent. */
export interface DrawdownSeriesPoint {
  time: number;
  drawdownPct: number;
}

interface DrawdownVsBuyHoldPanelProps {
  /** Strategy equity drawdown series (from the equity read). */
  strategySeries: DrawdownSeriesPoint[] | null;
  /**
   * BTC buy-hold drawdown over the same window. `null` until the app exposes a
   * price-aligned series — the panel shows an empty state rather than
   * fabricating the buy-hold leg.
   */
  buyHoldSeries: DrawdownSeriesPoint[] | null;
}

interface MergedPoint {
  time: number;
  strat: number | null;
  bh: number | null;
}

function DdTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipItem<MergedPoint>[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded-md border border-[var(--border-default)] px-3 py-2 text-left"
      style={{ background: 'var(--bg-elevated)', minWidth: 160 }}
    >
      <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">{formatDate(d.time)}</p>
      <p className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--color-profit)' }}>
        Strategy {d.strat != null ? `${d.strat.toFixed(2)}%` : '—'}
      </p>
      <p className="font-mono text-[11px] tabular-nums" style={{ color: 'var(--color-loss)' }}>
        BTC buy-hold {d.bh != null ? `${d.bh.toFixed(2)}%` : '—'}
      </p>
    </div>
  );
}

const norm = (v: number) => (v > 0 ? -v : v);

/**
 * Strategy drawdown overlaid on BTC buy-hold drawdown over the same window —
 * the crisis-alpha framing (the strategy cuts drawdown roughly in half).
 * Requires both an equity series and a price-aligned buy-hold series; until
 * both exist it renders an empty state and never invents the buy-hold leg.
 */
export function DrawdownVsBuyHoldPanel({
  strategySeries,
  buyHoldSeries,
}: DrawdownVsBuyHoldPanelProps) {
  const data = useMemo<MergedPoint[]>(() => {
    if (!strategySeries || !buyHoldSeries) return [];
    if (strategySeries.length === 0 || buyHoldSeries.length === 0) return [];
    const byTime = new Map<number, MergedPoint>();
    for (const p of strategySeries) {
      byTime.set(p.time, { time: p.time, strat: norm(p.drawdownPct), bh: null });
    }
    for (const p of buyHoldSeries) {
      const existing = byTime.get(p.time);
      if (existing) existing.bh = norm(p.drawdownPct);
      else byTime.set(p.time, { time: p.time, strat: null, bh: norm(p.drawdownPct) });
    }
    return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  }, [strategySeries, buyHoldSeries]);

  if (data.length === 0) {
    return (
      <PanelShell title="Drawdown vs buy-hold" subtitle="strategy vs holding BTC">
        <PanelEmptyState message="Drawdown-vs-buy-hold requires price history (coming soon)" />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="Drawdown vs buy-hold"
      subtitle="strategy vs holding BTC"
      headerRight={
        <div className="flex items-center gap-3 text-[11px] font-semibold">
          <span style={{ color: 'var(--color-profit)' }}>● Strategy</span>
          <span style={{ color: 'var(--color-loss)' }}>● BTC buy-hold</span>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
            tick={{ fill: '#4A5160', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            domain={['dataMin', 0]}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tick={{ fill: '#4A5160', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<DdTooltip />} />
          <Area
            type="monotone"
            dataKey="bh"
            stroke="#FF4D6A"
            strokeWidth={1.25}
            fill="#FF4D6A"
            fillOpacity={0.12}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="strat"
            stroke="#00C896"
            strokeWidth={1.5}
            fill="#00C896"
            fillOpacity={0.14}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}
