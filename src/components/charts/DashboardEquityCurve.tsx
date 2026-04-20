'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
} from 'recharts';
import { ChartPanelShell } from './ChartPanelShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useEquityCurve, type EquityPeriod } from '@/hooks/useEquityCurve';
import { formatPrice, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

const PERIODS: EquityPeriod[] = ['7D', '30D', '90D', 'ALL'];

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface EquityPayloadItem {
  payload: { time: number; equity: number; drawdown: number };
}

function EquityTooltip({
  active,
  payload,
  initialCapital,
}: {
  active?: boolean;
  payload?: EquityPayloadItem[];
  initialCapital: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const change = d.equity - initialCapital;
  const changePct = initialCapital !== 0 ? (change / initialCapital) * 100 : 0;

  return (
    <div
      className="rounded-md border border-[var(--border-default)] px-3.5 py-3 text-left"
      style={{ background: 'var(--bg-elevated)', minWidth: 160 }}
    >
      <p className="mb-2 font-mono text-[10px] text-[var(--text-muted)]">{formatDate(d.time)}</p>
      <p className="font-display text-lg font-semibold tabular-nums text-[var(--text-primary)]">
        ${formatPrice(d.equity)}
      </p>
      <p
        className={cn(
          'mt-0.5 font-mono text-xs tabular-nums',
          change >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]',
        )}
      >
        {change >= 0 ? '+' : ''}
        {formatPrice(change)} ({changePct.toFixed(2)}%)
      </p>
      <p className="mt-1.5 font-mono text-[10px] text-[var(--color-loss)]">
        DD: {d.drawdown.toFixed(2)}%
      </p>
    </div>
  );
}

// ─── Period tabs ──────────────────────────────────────────────────────────────

function PeriodTabs({ value, onChange }: { value: EquityPeriod; onChange: (p: EquityPeriod) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-[var(--bg-overlay)] p-0.5">
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            'rounded px-2 py-1 font-mono text-[11px] font-medium transition-colors',
            p === value
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardEquityCurve({ className }: { className?: string }) {
  const { period, setPeriod, points, stats, isLoading, initialCapital } = useEquityCurve();

  const isProfit = (stats?.change ?? 0) >= 0;

  const chartData = useMemo(
    () => points.map((p) => ({ ...p, timestamp: p.time })),
    [points],
  );

  const yMin = useMemo(
    () => Math.min(...points.map((p) => p.equity)) * 0.99,
    [points],
  );
  const yMax = useMemo(
    () => Math.max(...points.map((p) => p.equity)) * 1.01,
    [points],
  );

  return (
    <ChartPanelShell
      title="Equity Curve"
      headerRight={<PeriodTabs value={period} onChange={setPeriod} />}
      className={className}
    >
      {/* Hero row */}
      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
              ${formatPrice(stats?.latest ?? initialCapital)}
            </span>
            <span
              className={cn(
                'flex items-center gap-1 font-mono text-sm tabular-nums',
                isProfit ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]',
              )}
            >
              {isProfit ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {isProfit ? '+' : ''}
              {formatPrice(stats?.change ?? 0)} ({(stats?.changePct ?? 0).toFixed(2)}%)
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              from ${formatPrice(initialCapital)} initial
            </span>
          </div>
        )}
      </div>

      {/* Equity chart */}
      <div className="px-1 pt-3">
        {isLoading ? (
          <Skeleton className="mx-3 h-44" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C896" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#00C896" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(v: number) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                tick={{ fill: '#4A5160', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(v: number) => `$${(v / 1_000).toFixed(1)}K`}
                tick={{ fill: '#4A5160', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={<EquityTooltip initialCapital={initialCapital} />} />
              <ReferenceLine y={initialCapital} stroke="#2A2F3A" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="#00C896"
                strokeWidth={1.5}
                fill="url(#equityGrad)"
                dot={false}
                activeDot={{ r: 3, fill: '#00C896' }}
                isAnimationActive={chartData.length < 100}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Drawdown sub-chart */}
      <div className="px-1 pb-2">
        <div className="mb-1 px-3 font-mono text-[10px] text-[var(--text-muted)]">
          Max DD: {(stats?.maxDrawdown ?? 0).toFixed(2)}%
        </div>
        {isLoading ? (
          <Skeleton className="mx-3 h-14" />
        ) : (
          <ResponsiveContainer width="100%" height={56}>
            <AreaChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF4D6A" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FF4D6A" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis reversed tick={false} axisLine={false} tickLine={false} width={52} />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#FF4D6A"
                strokeWidth={1}
                fill="url(#ddGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </ChartPanelShell>
  );
}
