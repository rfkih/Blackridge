'use client';

import { useMemo } from 'react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_TICK, CHART_COLORS, TOOLTIP_CONTENT_STYLE } from '@/lib/charts/rechartsTheme';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import type { DailyPnl } from '@/types/pnl';

interface CumulativePnlChartProps {
  data: DailyPnl[];
  height?: number;
}

interface CumulativePoint {
  date: string;
  cumulative: number;
  daily: number;
}

interface TooltipItem {
  payload: CumulativePoint;
}

export function CumulativePnlChart({ data, height = 240 }: CumulativePnlChartProps) {
  const formatCurrency = useCurrencyFormatter();
  const CumulativeTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: TooltipItem[];
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const cumUp = d.cumulative >= 0;
    const dayUp = d.daily >= 0;
    return (
      <div
        className="rounded-md border border-[var(--border-default)] px-3 py-2 text-left"
        style={{ background: 'var(--bg-elevated)', minWidth: 160 }}
      >
        <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">{d.date}</p>
        <p
          className="font-display text-sm font-semibold tabular-nums"
          style={{ color: cumUp ? CHART_COLORS.profit : CHART_COLORS.loss }}
        >
          {formatCurrency(d.cumulative, { withSign: true })}
        </p>
        <p
          className="mt-0.5 font-mono text-[11px] tabular-nums"
          style={{ color: dayUp ? CHART_COLORS.profit : CHART_COLORS.loss }}
        >
          {formatCurrency(d.daily, { withSign: true })} today
        </p>
      </div>
    );
  };

  const series = useMemo<CumulativePoint[]>(() => {
    let running = 0;
    return data.map((d) => {
      running += d.realizedPnl;
      return { date: d.date, cumulative: running, daily: d.realizedPnl };
    });
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={series} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pnl-cum-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.profit} stopOpacity={0.28} />
            <stop offset="95%" stopColor={CHART_COLORS.profit} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={AXIS_TICK}
          axisLine={{ stroke: CHART_COLORS.axis }}
          tickLine={{ stroke: CHART_COLORS.axis }}
          interval="preserveStartEnd"
          minTickGap={32}
          tickFormatter={(v: string) => v.slice(5)}
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
        <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<CumulativeTooltip />} />
        <ReferenceLine y={0} stroke={CHART_COLORS.neutralDim} strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="cumulative"
          stroke={CHART_COLORS.profit}
          strokeWidth={1.75}
          fill="url(#pnl-cum-grad)"
          dot={false}
          activeDot={{ r: 3, fill: CHART_COLORS.profit }}
          isAnimationActive={series.length < 200}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
