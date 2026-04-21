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
import { formatDate, formatPrice } from '@/lib/formatters';

export interface EquityCurvePoint {
  ts: number;
  equity: number;
}

interface EquityCurveProps {
  points: EquityCurvePoint[];
  initialCapital?: number;
  height?: number;
}

interface TooltipItem {
  payload: { ts: number; equity: number };
}

function EquityTooltip({
  active,
  payload,
  initialCapital,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  initialCapital: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const change = d.equity - initialCapital;
  const pct = initialCapital !== 0 ? (change / initialCapital) * 100 : 0;
  const up = change >= 0;
  return (
    <div
      className="rounded-md border border-[var(--border-default)] px-3 py-2 text-left"
      style={{ background: 'var(--bg-elevated)', minWidth: 150 }}
    >
      <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">{formatDate(d.ts)}</p>
      <p className="font-display text-sm font-semibold tabular-nums text-[var(--text-primary)]">
        ${formatPrice(d.equity)}
      </p>
      <p
        className="mt-0.5 font-mono text-[11px] tabular-nums"
        style={{ color: up ? 'var(--color-profit)' : 'var(--color-loss)' }}
      >
        {up ? '+' : ''}
        {formatPrice(change)} ({pct.toFixed(2)}%)
      </p>
    </div>
  );
}

export function EquityCurve({ points, initialCapital, height = 220 }: EquityCurveProps) {
  const capital = initialCapital ?? points[0]?.equity ?? 0;
  const data = useMemo(() => points.map((p) => ({ ts: p.ts, equity: p.equity })), [points]);

  const [yMin, yMax] = useMemo(() => {
    if (!data.length) return [0, 1];
    // Single pass — Math.min/max on a spread of thousands of values can hit
    // the JS call-stack limit (notably Safari).
    let lo = capital;
    let hi = capital;
    for (let i = 0; i < data.length; i++) {
      const v = data[i].equity;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const pad = (hi - lo) * 0.05 || hi * 0.01;
    return [lo - pad, hi + pad];
  }, [data, capital]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bt-equity-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00C896" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#00C896" stopOpacity={0.02} />
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
          tick={{ fill: '#4A5160', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
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
          tick={{ fill: '#4A5160', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip content={<EquityTooltip initialCapital={capital} />} />
        <ReferenceLine y={capital} stroke="#2A2F3A" strokeDasharray="3 3" />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#00C896"
          strokeWidth={1.5}
          fill="url(#bt-equity-grad)"
          dot={false}
          activeDot={{ r: 3, fill: '#00C896' }}
          isAnimationActive={data.length < 200}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
