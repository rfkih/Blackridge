'use client';

import { useMemo } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { formatDate } from '@/lib/formatters';
import type { ChartTooltipItem } from '@/lib/charts/rechartsTheme';
import { useChartTheme } from '@/lib/charts/useChartTheme';

export interface EquityCurvePoint {
  ts: number;
  equity: number;
}

/**
 * Optional second series overlaid on the equity curve as a line (e.g. a
 * buy-and-hold benchmark). Values must already be aligned to the same `ts`
 * axis as the strategy `points`.
 */
export interface EquityCompareSeries {
  points: EquityCurvePoint[];
  label: string;
  color: string;
}

interface EquityCurveProps {
  points: EquityCurvePoint[];
  initialCapital?: number;
  height?: number;
  /** Optional benchmark line (buy-and-hold). When absent, renders as before. */
  compareSeries?: EquityCompareSeries;
  /** Optional extra solid overlay lines aligned to the same `ts` axis — e.g. the
   *  equity composition legs (BTC value, USDT cash). Each renders as its own line
   *  and extends the y-domain so a leg dropping toward zero stays visible. */
  overlaySeries?: EquityCompareSeries[];
}

type EquityRow = { ts: number; equity: number; compare: number | null } & Record<string, number | null>;

const overlayKey = (i: number) => `ov${i}`;

export function EquityCurve({
  points,
  initialCapital,
  height = 220,
  compareSeries,
  overlaySeries,
}: EquityCurveProps) {
  const { CHART_COLORS } = useChartTheme();
  const capital = initialCapital ?? points[0]?.equity ?? 0;
  const overlays = useMemo(() => overlaySeries ?? [], [overlaySeries]);
  const data = useMemo<EquityRow[]>(() => {
    const compareByTs = new Map<number, number>();
    if (compareSeries) for (const c of compareSeries.points) compareByTs.set(c.ts, c.equity);
    const overlayMaps = overlays.map((s) => {
      const m = new Map<number, number>();
      for (const p of s.points) m.set(p.ts, p.equity);
      return m;
    });
    return points.map((p) => {
      const row: EquityRow = {
        ts: p.ts,
        equity: p.equity,
        compare: compareSeries && compareByTs.has(p.ts) ? (compareByTs.get(p.ts) as number) : null,
      };
      overlays.forEach((_, i) => {
        const m = overlayMaps[i];
        row[overlayKey(i)] = m.has(p.ts) ? (m.get(p.ts) as number) : null;
      });
      return row;
    });
  }, [points, compareSeries, overlays]);
  const formatCurrency = useCurrencyFormatter();

  const EquityTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ChartTooltipItem<EquityRow>[];
  }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const change = d.equity - capital;
    const pct = capital !== 0 ? (change / capital) * 100 : 0;
    const up = change >= 0;
    const compare = d.compare;
    return (
      <div
        className="rounded-md border border-[var(--border-default)] px-3 py-2 text-left"
        style={{ background: 'var(--bg-elevated)', minWidth: 150 }}
      >
        <p className="mb-1 font-mono text-[12px] text-[var(--text-muted)]">{formatDate(d.ts)}</p>
        <p className="font-display text-sm font-semibold tabular-nums text-[var(--text-primary)]">
          {formatCurrency(d.equity)}
        </p>
        <p
          className="mt-0.5 font-mono text-[13px] tabular-nums"
          style={{ color: up ? 'var(--color-profit)' : 'var(--color-loss)' }}
        >
          {formatCurrency(change, { withSign: true })} ({pct.toFixed(2)}%)
        </p>
        {compareSeries && compare != null && (
          <p
            className="mt-1 font-mono text-[13px] tabular-nums"
            style={{ color: compareSeries.color }}
          >
            {compareSeries.label} {formatCurrency(compare)}
          </p>
        )}
        {overlays.map((s, i) => {
          const v = d[overlayKey(i)];
          if (v == null) return null;
          return (
            <p
              key={s.label}
              className="mt-1 font-mono text-[13px] tabular-nums"
              style={{ color: s.color }}
            >
              {s.label} {formatCurrency(v)}
            </p>
          );
        })}
      </div>
    );
  };

  const [yMin, yMax] = useMemo(() => {
    if (!data.length) return [0, 1];

    let lo = capital;
    let hi = capital;
    for (let i = 0; i < data.length; i++) {
      const v = data[i].equity;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
      const c = data[i].compare;
      if (c != null) {
        if (c < lo) lo = c;
        if (c > hi) hi = c;
      }
      for (let k = 0; k < overlays.length; k++) {
        const ov = data[i][overlayKey(k)];
        if (ov != null) {
          if (ov < lo) lo = ov;
          if (ov > hi) hi = ov;
        }
      }
    }
    const pad = (hi - lo) * 0.05 || hi * 0.01;
    return [lo - pad, hi + pad];
  }, [data, capital, overlays.length]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bt-equity-grad" x1="0" y1="0" x2="0" y2="1">
            {/* Resolved theme token (recharts writes SVG attrs, which don't
                resolve var()) — hardcoded #00C896 was pinned to dark mode. */}
            <stop offset="5%" stopColor={CHART_COLORS.profit} stopOpacity={0.32} />
            <stop offset="95%" stopColor={CHART_COLORS.profit} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="ts"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v: number) => {
            const d = new Date(v);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
          tick={{ fill: CHART_COLORS.neutral, fontSize: 12, fontFamily: 'IBM Plex Mono, ui-monospace, monospace' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={32}
        />
        <YAxis
          domain={[yMin, yMax]}
          tickFormatter={(v: number) =>
            v >= 1_000 ? `$${(v / 1_000).toFixed(1)}K` : `$${v.toFixed(0)}`
          }
          tick={{ fill: CHART_COLORS.neutral, fontSize: 12, fontFamily: 'IBM Plex Mono, ui-monospace, monospace' }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip content={<EquityTooltip />} />
        <ReferenceLine y={capital} stroke={CHART_COLORS.axis} strokeDasharray="3 3" />
        {compareSeries && (
          <Line
            type="monotone"
            dataKey="compare"
            stroke={compareSeries.color}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls
            isAnimationActive={false}
            name={compareSeries.label}
          />
        )}
        {overlays.map((s, i) => (
          <Line
            key={s.label}
            type="monotone"
            dataKey={overlayKey(i)}
            stroke={s.color}
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
            name={s.label}
          />
        ))}
        <Area
          type="monotone"
          dataKey="equity"
          stroke={CHART_COLORS.profit}
          strokeWidth={1.5}
          fill="url(#bt-equity-grad)"
          dot={false}
          activeDot={{ r: 3, fill: CHART_COLORS.profit }}
          isAnimationActive={data.length < 200}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
