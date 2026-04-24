'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_TICK, CHART_COLORS, TOOLTIP_CONTENT_STYLE } from '@/lib/charts/rechartsTheme';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import type { DailyPnl } from '@/types/pnl';

interface PnlBarChartProps {
  data: DailyPnl[];
  height?: number;
}

interface TooltipItem {
  payload: DailyPnl;
  value: number;
}

export function PnlBarChart({ data, height = 260 }: PnlBarChartProps) {
  const memoData = useMemo(() => data, [data]);
  const formatCurrency = useCurrencyFormatter();
  const PnlBarTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const up = d.realizedPnl >= 0;
    return (
      <div
        className="rounded-md border border-[var(--border-default)] px-3 py-2 text-left"
        style={{ background: 'var(--bg-elevated)', minWidth: 150 }}
      >
        <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">{d.date}</p>
        <p
          className="font-display text-sm font-semibold tabular-nums"
          style={{ color: up ? CHART_COLORS.profit : CHART_COLORS.loss }}
        >
          {formatCurrency(d.realizedPnl, { withSign: true })}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
          {d.tradeCount} trade{d.tradeCount === 1 ? '' : 's'}
        </p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={memoData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          axisLine={{ stroke: CHART_COLORS.axis }}
          tickLine={{ stroke: CHART_COLORS.axis }}
          interval="preserveStartEnd"
          minTickGap={32}
          tickFormatter={(v: string) => v.slice(5)} // MM-DD, saves horizontal space
        />
        <YAxis
          tick={AXIS_TICK}
          axisLine={{ stroke: CHART_COLORS.axis }}
          tickLine={{ stroke: CHART_COLORS.axis }}
          width={56}
          tickFormatter={(v: number) =>
            Math.abs(v) >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toFixed(0)
          }
        />
        <Tooltip
          cursor={{ fill: 'rgba(78,158,255,0.06)' }}
          contentStyle={TOOLTIP_CONTENT_STYLE}
          content={<PnlBarTooltip />}
        />
        <ReferenceLine y={0} stroke={CHART_COLORS.neutralDim} strokeDasharray="3 3" />
        <Bar dataKey="realizedPnl" isAnimationActive={memoData.length < 200}>
          {memoData.map((d) => (
            <Cell
              key={d.date}
              fill={d.realizedPnl >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
