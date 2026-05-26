'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS_TICK,
  CHART_COLORS,
  type ChartTooltipItem,
} from '@/lib/charts/rechartsTheme';
import type { TradePoint } from '@/types/papers';

interface PaperTradeHistogramProps {
  trades: TradePoint[];
  height?: number;
}

interface TradeDatum {
  n: number;
  pnl_pct: number;
  side: string;
  entry: string;
  exit: string | null;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

const TradeTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipItem<TradeDatum>[];
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const up = d.pnl_pct >= 0;
  return (
    <div
      className="rounded-md border px-3 py-2 text-left"
      style={{ background: CHART_COLORS.surface, borderColor: CHART_COLORS.axis, minWidth: 150 }}
    >
      <p className="mb-1 font-mono text-[10px]" style={{ color: CHART_COLORS.neutral }}>
        Trade #{d.n} · {d.side}
      </p>
      <p
        className="font-mono text-[12px] font-semibold tabular-nums"
        style={{ color: up ? CHART_COLORS.profit : CHART_COLORS.loss }}
      >
        {up ? '+' : ''}{d.pnl_pct.toFixed(3)}%
      </p>
      <p className="mt-0.5 font-mono text-[10px]" style={{ color: CHART_COLORS.neutral }}>
        {fmtDate(d.entry)}{d.exit ? ` → ${fmtDate(d.exit)}` : ' → open'}
      </p>
    </div>
  );
};

export function PaperTradeHistogram({ trades, height = 200 }: PaperTradeHistogramProps) {
  const data = useMemo<TradeDatum[]>(() => {
    return trades
      .filter((t) => t.pnl_pct != null && t.exit_time != null)
      .map((t, i) => ({
        n: i + 1,
        pnl_pct: t.pnl_pct!,
        side: t.side ?? '?',
        entry: t.entry_time,
        exit: t.exit_time,
      }));
  }, [trades]);

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-[12px] text-text-muted"
        style={{ height }}
      >
        No trade data available.
      </div>
    );
  }

  const wins = data.filter((d) => d.pnl_pct >= 0).length;
  const winRate = ((wins / data.length) * 100).toFixed(1);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] text-text-muted">
          {data.length} trades · {winRate}% win rate
        </span>
        <span className="font-mono text-[10px]" style={{ color: CHART_COLORS.profit }}>
          {wins} wins
        </span>
        <span className="font-mono text-[10px]" style={{ color: CHART_COLORS.loss }}>
          {data.length - wins} losses
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="n"
            tick={false}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
            tick={{ ...AXIS_TICK, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ fill: 'rgba(59,130,246,0.06)' }}
            content={<TradeTooltip />}
          />
          <ReferenceLine y={0} stroke={CHART_COLORS.neutralDim} strokeDasharray="3 3" />
          <Bar dataKey="pnl_pct" isAnimationActive={data.length < 300} maxBarSize={6}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.pnl_pct >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
