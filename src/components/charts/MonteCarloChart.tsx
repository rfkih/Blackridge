'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { type ChartTooltipItem } from '@/lib/charts/rechartsTheme';
import { useChartTheme } from '@/lib/charts/useChartTheme';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import type { MonteCarloResult } from '@/types/montecarlo';

interface MonteCarloChartProps {
  result: MonteCarloResult;
  height?: number;
}

interface ChartRow {
  trade: number;
  best: number | null;
  median: number | null;
  worst: number | null;
}

/**
 * "Fan chart" of the three representative simulation paths. The backend only
 * returns best/median/worst equity curves (not per-trade percentile bands),
 * so we render them as three lines — which preserves the analytical value
 * without pretending we have data we don't.
 */
export function MonteCarloChart({ result, height = 320 }: MonteCarloChartProps) {
  const formatCurrency = useCurrencyFormatter();
  const { CHART_COLORS, AXIS_TICK, TOOLTIP_CONTENT_STYLE } = useChartTheme();

  const MonteCarloTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ChartTooltipItem<ChartRow>[];
  }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    return (
      <div
        className="rounded-md border border-[var(--border-default)] px-3 py-2 text-left"
        style={{ background: 'var(--bg-elevated)', minWidth: 180 }}
      >
        <p className="mb-1 font-mono text-[12px] text-[var(--text-muted)]">Trade #{row.trade}</p>
        {payload.map((p) => {
          if (!p.name) return null;
          const key = p.name.toLowerCase() as keyof ChartRow;
          return (
            <div key={p.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-[13px]" style={{ color: p.color }}>
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="num text-[13px] text-[var(--text-primary)]">
                {formatCurrency(p.payload[key] as number)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const rows = useMemo<ChartRow[]>(() => {
    const best = result.bestPath?.equityCurve ?? [];
    const median = result.medianPath?.equityCurve ?? [];
    const worst = result.worstPath?.equityCurve ?? [];
    const maxLen = Math.max(best.length, median.length, worst.length);
    if (maxLen === 0) return [];
    const out: ChartRow[] = [];
    for (let i = 0; i < maxLen; i++) {
      out.push({
        trade: i,
        best: i < best.length ? best[i] : null,
        median: i < median.length ? median[i] : null,
        worst: i < worst.length ? worst[i] : null,
      });
    }
    return out;
  }, [result]);

  if (!rows.length) {
    return (
      <div className="flex h-[240px] items-center justify-center text-[14px] text-text-muted">
        No equity curves were returned for this run.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="trade"
          tick={AXIS_TICK}
          axisLine={{ stroke: CHART_COLORS.axis }}
          tickLine={{ stroke: CHART_COLORS.axis }}
          interval="preserveStartEnd"
          minTickGap={32}
        />
        <YAxis
          tick={AXIS_TICK}
          axisLine={{ stroke: CHART_COLORS.axis }}
          tickLine={{ stroke: CHART_COLORS.axis }}
          width={68}
          tickFormatter={(v: number) =>
            Math.abs(v) >= 1_000 ? `$${(v / 1_000).toFixed(1)}K` : `$${v.toFixed(0)}`
          }
        />
        <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} content={<MonteCarloTooltip />} />
        <ReferenceLine
          y={result.initialCapital}
          stroke={CHART_COLORS.neutralDim}
          strokeDasharray="3 3"
          label={{
            value: 'Initial',
            position: 'insideBottomLeft',
            fill: CHART_COLORS.neutral,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 13, color: CHART_COLORS.neutral }} />
        <Line
          name="Best"
          type="monotone"
          dataKey="best"
          stroke={CHART_COLORS.profit}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={rows.length < 300}
          connectNulls
        />
        <Line
          name="Median"
          type="monotone"
          dataKey="median"
          stroke={CHART_COLORS.info}
          strokeWidth={2}
          dot={false}
          isAnimationActive={rows.length < 300}
          connectNulls
        />
        <Line
          name="Worst"
          type="monotone"
          dataKey="worst"
          stroke={CHART_COLORS.loss}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={rows.length < 300}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
