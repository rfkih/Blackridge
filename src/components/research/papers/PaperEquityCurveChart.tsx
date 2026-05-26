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
import {
  AXIS_TICK,
  CHART_COLORS,
  type ChartTooltipItem,
} from '@/lib/charts/rechartsTheme';
import type { EquityPoint } from '@/types/papers';

interface PaperEquityCurveChartProps {
  curve: EquityPoint[];
  wfCurve?: EquityPoint[] | null;
  height?: number;
  /** Unique suffix appended to SVG gradient IDs to avoid collisions when
   *  multiple chart instances appear on the same page. */
  gradientId?: string;
}

interface ChartDatum {
  t: number;
  is: number | null;
  wf: number | null;
}

interface TooltipPayload {
  t: number;
  is: number | null;
  wf: number | null;
}

// Defined outside the component so React sees a stable component type across
// renders. Defining it inside would give a new function reference each render
// and cause Recharts to unmount/remount the tooltip on every update.
const EqTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipItem<TooltipPayload>[];
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 text-left"
      style={{ background: CHART_COLORS.surface, borderColor: CHART_COLORS.axis, minWidth: 160 }}
    >
      <p className="mb-1 font-mono text-[10px]" style={{ color: CHART_COLORS.neutral }}>
        {fmtDate(d.t)}
      </p>
      {d.is !== null && (
        <p className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: CHART_COLORS.profit }}>
          IS: {d.is.toFixed(2)}{' '}
          <span className="font-normal text-[10px]">({(d.is - 100).toFixed(2)}%)</span>
        </p>
      )}
      {d.wf !== null && (
        <p className="font-mono text-[12px] font-semibold tabular-nums" style={{ color: CHART_COLORS.info }}>
          WF: {d.wf.toFixed(2)}{' '}
          <span className="font-normal text-[10px]">({(d.wf - 100).toFixed(2)}%)</span>
        </p>
      )}
    </div>
  );
};

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function fmtAxis(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function PaperEquityCurveChart({
  curve,
  wfCurve,
  height = 240,
  gradientId = 'a',
}: PaperEquityCurveChartProps) {
  const gradIs = `paper-eq-grad-${gradientId}`;
  const gradWf = `paper-wf-grad-${gradientId}`;
  const data = useMemo<ChartDatum[]>(() => {
    const isMap = new Map<number, number>();
    for (const p of curve) isMap.set(p.t, p.value);
    const wfMap = new Map<number, number>();
    for (const p of wfCurve ?? []) wfMap.set(p.t, p.value);

    const allTs = Array.from(new Set([...Array.from(isMap.keys()), ...Array.from(wfMap.keys())])).sort((a, b) => a - b);

    return allTs.map((t) => ({
      t,
      is: isMap.has(t) ? isMap.get(t)! : null,
      wf: wfMap.has(t) ? wfMap.get(t)! : null,
    }));
  }, [curve, wfCurve]);

  const hasWf = (wfCurve?.length ?? 0) > 0;

  const [yMin, yMax] = useMemo(() => {
    let lo = 100;
    let hi = 100;
    for (const d of data) {
      if (d.is !== null) { if (d.is < lo) lo = d.is; if (d.is > hi) hi = d.is; }
      if (d.wf !== null) { if (d.wf < lo) lo = d.wf; if (d.wf > hi) hi = d.wf; }
    }
    const pad = (hi - lo) * 0.06 || 2;
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }, [data]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-[12px] text-text-muted" style={{ height }}>
        No equity data available.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradIs} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.profit} stopOpacity={0.28} />
            <stop offset="95%" stopColor={CHART_COLORS.profit} stopOpacity={0.02} />
          </linearGradient>
          {hasWf && (
            <linearGradient id={gradWf} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.info} stopOpacity={0.2} />
              <stop offset="95%" stopColor={CHART_COLORS.info} stopOpacity={0.01} />
            </linearGradient>
          )}
        </defs>
        <XAxis
          dataKey="t"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={fmtAxis}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          domain={[yMin, yMax]}
          tickFormatter={(v: number) => v.toFixed(0)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<EqTooltip />} />
        <ReferenceLine y={100} stroke={CHART_COLORS.axis} strokeDasharray="4 3" />
        <Area
          type="monotone"
          dataKey="is"
          name="In-sample"
          stroke={CHART_COLORS.profit}
          strokeWidth={1.5}
          fill={`url(#${gradIs})`}
          dot={false}
          activeDot={{ r: 3, fill: CHART_COLORS.profit }}
          connectNulls
          isAnimationActive={data.length < 300}
        />
        {hasWf && (
          <Line
            type="monotone"
            dataKey="wf"
            name="Walk-forward"
            stroke={CHART_COLORS.info}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 3, fill: CHART_COLORS.info }}
            connectNulls
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
