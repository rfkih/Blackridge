'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Layers, TrendingUp } from 'lucide-react';
import { type ChartTooltipItem } from '@/lib/charts/rechartsTheme';
import { useChartTheme } from '@/lib/charts/useChartTheme';
import type { EquityPoint } from '@/types/papers';

interface PaperEquityCurveChartProps {
  curve: EquityPoint[];
  wfCurve?: EquityPoint[] | null;
  height?: number;
  gradientId?: string;
}

interface ChartDatum {
  t: number;
  is: number | null;
  wf: number | null;
  regime: string | null;
}

interface TooltipPayload {
  t: number;
  is: number | null;
  wf: number | null;
  regime: string | null;
}

// ---------------------------------------------------------------------------
// Performance zones (momentum-based)
// ---------------------------------------------------------------------------

type ZoneType = 'strong' | 'weak';
interface Zone { x1: number; x2: number; type: ZoneType }

const ZONE_WINDOW = 30;
const ZONE_THRESHOLD = 1.5;
const ZONE_NEUTRAL_TOLERANCE = 5;

const ZONE_COLORS: Record<ZoneType, string> = {
  strong: 'rgba(22,179,100,0.11)',
  weak: 'rgba(229,72,77,0.09)',
};

const ZONE_LEGEND: Record<ZoneType, { label: string; swatch: string }> = {
  strong: { label: 'Strong', swatch: 'rgba(22,179,100,0.55)' },
  weak: { label: 'Weak', swatch: 'rgba(229,72,77,0.55)' },
};

function computeZones(data: ChartDatum[]): Zone[] {
  if (data.length <= ZONE_WINDOW) return [];

  const segments: Zone[] = [];
  let current: Zone | null = null;
  let neutralCount = 0;
  let lastConfirmedT = 0;

  for (let i = ZONE_WINDOW; i < data.length; i++) {
    const prev = data[i - ZONE_WINDOW]?.is;
    const now = data[i]?.is;

    let type: ZoneType | null = null;
    if (prev != null && now != null && prev !== 0) {
      const momentum = ((now - prev) / prev) * 100;
      type = momentum > ZONE_THRESHOLD ? 'strong' : momentum < -ZONE_THRESHOLD ? 'weak' : null;
    }

    if (type !== null && current !== null && type === current.type) {
      current.x2 = data[i].t;
      lastConfirmedT = data[i].t;
      neutralCount = 0;
    } else if (type === null && current !== null) {
      neutralCount++;
      if (neutralCount > ZONE_NEUTRAL_TOLERANCE) {
        current.x2 = lastConfirmedT;
        segments.push(current);
        current = null;
        neutralCount = 0;
      }
    } else if (type !== null) {
      if (current !== null) {
        current.x2 = lastConfirmedT;
        segments.push(current);
      }
      current = { x1: data[i].t, x2: data[i].t, type };
      lastConfirmedT = data[i].t;
      neutralCount = 0;
    }
  }
  if (current) {
    current.x2 = lastConfirmedT;
    segments.push(current);
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Regime zones (market regime from strategy classification)
// ---------------------------------------------------------------------------

interface RegimeZone { x1: number; x2: number; regime: string }

function regimeFill(regime: string): string {
  const u = regime.toUpperCase();
  if (u.startsWith('BULL')) return 'rgba(22,179,100,0.09)';
  if (u.startsWith('BEAR')) return 'rgba(229,72,77,0.08)';
  if (u === 'NEUTRAL') return 'rgba(139,147,162,0.07)';
  return 'rgba(139,147,162,0.05)';
}

function regimeSwatch(regime: string): string {
  const u = regime.toUpperCase();
  if (u.startsWith('BULL')) return 'rgba(22,179,100,0.55)';
  if (u.startsWith('BEAR')) return 'rgba(229,72,77,0.55)';
  return 'rgba(139,147,162,0.50)';
}

function fmtRegime(regime: string): string {
  return regime.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeRegimeZones(data: ChartDatum[]): RegimeZone[] {
  const zones: RegimeZone[] = [];
  let current: RegimeZone | null = null;
  for (const d of data) {
    const r = d.regime;
    if (!r) {
      if (current) { zones.push(current); current = null; }
      continue;
    }
    if (current && current.regime === r) {
      current.x2 = d.t;
    } else {
      if (current) zones.push(current);
      current = { x1: d.t, x2: d.t, regime: r };
    }
  }
  if (current) zones.push(current);
  return zones;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

const EqTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipItem<TooltipPayload>[];
}) => {
  const { CHART_COLORS } = useChartTheme();
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 text-left"
      style={{ background: CHART_COLORS.surface, borderColor: CHART_COLORS.axis, minWidth: 160 }}
    >
      <p className="mb-1 font-mono text-[12px]" style={{ color: CHART_COLORS.neutral }}>
        {fmtDate(d.t)}
      </p>
      {d.is !== null && (
        <p className="font-mono text-[14px] font-semibold tabular-nums" style={{ color: CHART_COLORS.profit }}>
          IS: {d.is.toFixed(2)}{' '}
          <span className="font-normal text-[12px]">({(d.is - 100).toFixed(2)}%)</span>
        </p>
      )}
      {d.wf !== null && (
        <p className="font-mono text-[14px] font-semibold tabular-nums" style={{ color: CHART_COLORS.info }}>
          WF: {d.wf.toFixed(2)}{' '}
          <span className="font-normal text-[12px]">({(d.wf - 100).toFixed(2)}%)</span>
        </p>
      )}
      {d.regime && (
        <p className="mt-0.5 font-mono text-[12px]" style={{ color: regimeSwatch(d.regime) }}>
          {fmtRegime(d.regime)}
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

// ---------------------------------------------------------------------------
// Toggle pill — shared styling helper
// ---------------------------------------------------------------------------

function TogglePill({
  icon,
  label,
  active,
  disabled,
  title,
  onClick,
  activeColor,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  disabled: boolean;
  title: string;
  onClick: () => void;
  activeColor: string;
}) {
  const { CHART_COLORS } = useChartTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded px-2 py-0.5 transition-colors"
      style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        background: active ? `${activeColor}1e` : 'transparent',
        border: `1px solid ${active ? `${activeColor}4d` : 'var(--border-subtle)'}`,
        color: disabled ? CHART_COLORS.axis : active ? activeColor : CHART_COLORS.neutral,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
      title={title}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PaperEquityCurveChart({
  curve,
  wfCurve,
  height = 240,
  gradientId = 'a',
}: PaperEquityCurveChartProps) {
  const { CHART_COLORS, AXIS_TICK } = useChartTheme();
  const [showZones, setShowZones] = useState(false);
  const [showRegime, setShowRegime] = useState(false);

  const gradIs = `paper-eq-grad-${gradientId}`;
  const gradWf = `paper-wf-grad-${gradientId}`;

  const data = useMemo<ChartDatum[]>(() => {
    const isMap = new Map<number, number>();
    const regimeMap = new Map<number, string | null>();
    for (const p of curve) {
      isMap.set(p.t, p.value);
      regimeMap.set(p.t, p.regime ?? null);
    }
    const wfMap = new Map<number, number>();
    for (const p of wfCurve ?? []) wfMap.set(p.t, p.value);
    const allTs = Array.from(new Set([...Array.from(isMap.keys()), ...Array.from(wfMap.keys())])).sort((a, b) => a - b);
    return allTs.map((t) => ({
      t,
      is: isMap.has(t) ? isMap.get(t)! : null,
      wf: wfMap.has(t) ? wfMap.get(t)! : null,
      regime: regimeMap.get(t) ?? null,
    }));
  }, [curve, wfCurve]);

  const hasRegimeData = useMemo(() => curve.some((p) => p.regime != null), [curve]);

  const zones = useMemo<Zone[]>(
    () => (showZones ? computeZones(data) : []),
    [data, showZones],
  );

  const regimeZones = useMemo<RegimeZone[]>(
    () => (showRegime && hasRegimeData ? computeRegimeZones(data) : []),
    [data, showRegime, hasRegimeData],
  );

  const regimeLegendLabels = useMemo<string[]>(() => {
    if (!showRegime) return [];
    const seen = new Set<string>();
    for (const z of regimeZones) seen.add(z.regime);
    return Array.from(seen).sort();
  }, [regimeZones, showRegime]);

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
      <div className="flex items-center justify-center text-[14px] text-text-muted" style={{ height }}>
        No equity data available.
      </div>
    );
  }

  const tooShort = data.length <= ZONE_WINDOW;
  const activeLegend = showRegime ? regimeLegendLabels : showZones ? (Object.keys(ZONE_LEGEND) as ZoneType[]) : [];

  return (
    <div className="relative" style={{ height: typeof height === 'number' ? `${height}px` : height }}>

      {/* Legend — shown below toggle buttons, left-anchored after Y axis */}
      {activeLegend.length > 0 && (
        <div
          className="absolute left-12 top-1 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5"
          style={{ pointerEvents: 'none' }}
        >
          {showRegime
            ? regimeLegendLabels.map((r) => (
                <span key={r} className="flex items-center gap-1">
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: regimeSwatch(r), flexShrink: 0 }} />
                  <span className="font-mono text-[12px]" style={{ color: CHART_COLORS.neutral }}>{fmtRegime(r)}</span>
                </span>
              ))
            : (Object.keys(ZONE_LEGEND) as ZoneType[]).map((type) => (
                <span key={type} className="flex items-center gap-1">
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: ZONE_LEGEND[type].swatch, flexShrink: 0 }} />
                  <span className="font-mono text-[12px]" style={{ color: CHART_COLORS.neutral }}>{ZONE_LEGEND[type].label}</span>
                </span>
              ))
          }
        </div>
      )}

      {/* Toggle buttons — top-right */}
      <div className="absolute right-0 top-0 z-10 flex items-center gap-1">
        <TogglePill
          icon={<TrendingUp size={9} strokeWidth={2} />}
          label="Regime"
          active={showRegime}
          disabled={!hasRegimeData}
          title={!hasRegimeData ? 'Regenerate paper to get regime data' : showRegime ? 'Hide market regime' : 'Show market regime'}
          onClick={() => hasRegimeData && setShowRegime((v) => !v)}
          activeColor="#818cf8"
        />
        <TogglePill
          icon={<Layers size={9} strokeWidth={2} />}
          label="Zones"
          active={showZones}
          disabled={tooShort}
          title={tooShort ? `Need >${ZONE_WINDOW} bars for zones` : showZones ? 'Hide performance zones' : 'Show performance zones'}
          onClick={() => !tooShort && setShowZones((v) => !v)}
          activeColor={CHART_COLORS.profit}
        />
      </div>

      <ResponsiveContainer width="100%" height="100%">
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

          {/* Regime zones — deepest layer */}
          {regimeZones.map((z, i) => (
            <ReferenceArea key={`r${i}`} x1={z.x1} x2={z.x2} fill={regimeFill(z.regime)} stroke="none" />
          ))}

          {/* Performance zones — on top of regime, below curves */}
          {zones.map((z, i) => (
            <ReferenceArea key={`z${i}`} x1={z.x1} x2={z.x2} fill={ZONE_COLORS[z.type]} stroke="none" />
          ))}

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
    </div>
  );
}
