'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '@/lib/formatters';

export interface DrawdownPoint {
  ts: number;
  /** Drawdown as a negative-or-zero percentage (e.g. -5.2). */
  drawdownPct: number;
}

interface DrawdownChartProps {
  points: DrawdownPoint[];
  height?: number;
}

interface TooltipItem {
  payload: { ts: number; drawdownPct: number };
}

function DrawdownTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded-md border border-[var(--border-default)] px-3 py-2 text-left"
      style={{ background: 'var(--bg-elevated)', minWidth: 140 }}
    >
      <p className="mb-1 font-mono text-[10px] text-[var(--text-muted)]">{formatDate(d.ts)}</p>
      <p
        className="font-display text-sm font-semibold tabular-nums"
        style={{ color: 'var(--color-loss)' }}
      >
        {d.drawdownPct.toFixed(2)}%
      </p>
    </div>
  );
}

export function DrawdownChart({ points, height = 220 }: DrawdownChartProps) {
  // Normalise so drawdown is negative (underwater). Backend may send positive %.
  const data = useMemo(
    () =>
      points.map((p) => ({
        ts: p.ts,
        drawdownPct: p.drawdownPct > 0 ? -p.drawdownPct : p.drawdownPct,
      })),
    [points],
  );

  const minY = useMemo(() => {
    if (!data.length) return -1;
    let lo = data[0].drawdownPct;
    for (let i = 1; i < data.length; i++) {
      const v = data[i].drawdownPct;
      if (v < lo) lo = v;
    }
    // leave 10% breathing room, clamp to a reasonable floor
    return Math.min(lo * 1.1, -0.1);
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bt-dd-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FF4D6A" stopOpacity={0.05} />
            <stop offset="95%" stopColor="#FF4D6A" stopOpacity={0.45} />
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
          domain={[minY, 0]}
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          tick={{ fill: '#4A5160', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<DrawdownTooltip />} />
        <Area
          type="monotone"
          dataKey="drawdownPct"
          stroke="#FF4D6A"
          strokeWidth={1.25}
          fill="url(#bt-dd-grad)"
          dot={false}
          isAnimationActive={data.length < 200}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
