'use client';

import { useMemo } from 'react';
import {
  Area,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDate } from '@/lib/formatters';
import { AXIS_TICK, CHART_COLORS, type ChartTooltipItem } from '@/lib/charts/rechartsTheme';
import { PanelEmptyState, PanelShell } from './PanelShell';

/** BTC brand accent — the one deliberate non-token color, shared with
 *  `AllocationPanel`'s BTC bar so the hedging surface reads as "BTC". */
const BTC_ACCENT = '#F7931A';

/** One point on the BTC-stack scoreboard: `USDeq / (price/price₀)` expressed
 *  as a multiple of the buy-hold BTC stack (1.00 = matched buy-hold). */
export interface BtcStackPoint {
  time: number;
  stackMultiple: number;
}

interface BtcStackPanelProps {
  /**
   * The BTC-stack series. `null`/empty until the backend exposes a
   * price-aligned equity history — the panel renders an empty-state shell in
   * that case rather than fabricating a curve.
   */
  series: BtcStackPoint[] | null;
}

function StackTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipItem<BtcStackPoint>[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded-md border border-[var(--border-default)] px-3 py-2 text-left"
      style={{ background: 'var(--bg-elevated)', minWidth: 140 }}
    >
      <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">{formatDate(d.time)}</p>
      <p className="font-display text-sm font-semibold tabular-nums text-[var(--text-primary)]">
        {d.stackMultiple.toFixed(3)}×
      </p>
    </div>
  );
}

/**
 * BTC-stack scoreboard — BTC-denominated accumulation vs a flat 1.00 buy-hold
 * baseline (the "sell-high-rebuy-more-BTC" view). Requires a price-aligned
 * equity history; until the app exposes one, this renders a clear empty
 * state. It never invents a series.
 */
export function BtcStackPanel({ series }: BtcStackPanelProps) {
  const data = useMemo(() => series ?? [], [series]);
  const latest = data.length ? data[data.length - 1].stackMultiple : null;

  if (!series || data.length === 0) {
    return (
      <PanelShell title="BTC stack" subtitle="vs buy-hold (1.00×)">
        <PanelEmptyState message="BTC-stack requires price history (coming soon)" />
      </PanelShell>
    );
  }

  return (
    <PanelShell
      title="BTC stack"
      subtitle="vs buy-hold (1.00×)"
      headerRight={
        <div
          data-testid="btc-stack-latest"
          className="font-display tabular-nums"
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: latest != null && latest >= 1 ? 'var(--color-profit)' : 'var(--color-loss)',
          }}
        >
          {latest != null ? `${latest.toFixed(2)}×` : '—'}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="hedge-stack-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BTC_ACCENT} stopOpacity={0.3} />
              <stop offset="95%" stopColor={BTC_ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => {
              const d = new Date(v);
              return `${d.getMonth() + 1}/${d.getDate()}`;
            }}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={32}
          />
          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(2)}×`}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip content={<StackTooltip />} />
          <ReferenceLine y={1} stroke={CHART_COLORS.axis} strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="stackMultiple"
            stroke={BTC_ACCENT}
            strokeWidth={1.5}
            fill="url(#hedge-stack-grad)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </PanelShell>
  );
}
