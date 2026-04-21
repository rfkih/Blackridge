'use client';

import { useMemo } from 'react';
import { DrawdownChart } from '@/components/charts/DrawdownChart';
import { EquityCurve } from '@/components/charts/EquityCurve';
import { Skeleton } from '@/components/ui/skeleton';
import type { BacktestEquityPoint } from '@/types/backtest';

interface BacktestEquityPanelProps {
  points: BacktestEquityPoint[];
  initialCapital: number;
  isLoading?: boolean;
}

function PanelShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <div className="flex items-baseline justify-between border-b border-bd-subtle px-4 py-3">
        <h3 className="font-display text-[13px] font-semibold text-text-primary">{title}</h3>
        {subtitle && (
          <span className="font-mono text-[11px] tabular-nums text-text-muted">{subtitle}</span>
        )}
      </div>
      <div className="px-2 pb-2 pt-3">{children}</div>
    </div>
  );
}

export function BacktestEquityPanel({
  points,
  initialCapital,
  isLoading,
}: BacktestEquityPanelProps) {
  const equityPoints = useMemo(() => points.map((p) => ({ ts: p.ts, equity: p.equity })), [points]);

  const drawdownPoints = useMemo(
    () => points.map((p) => ({ ts: p.ts, drawdownPct: p.drawdownPct })),
    [points],
  );

  const maxDrawdown = useMemo(() => {
    if (!points.length) return 0;
    // Avoid Math.min(...arr) — spread on a thousands-long array can blow the
    // call-stack on some JS engines (Safari especially).
    let min = points[0].drawdownPct;
    for (let i = 1; i < points.length; i++) {
      const v = points[i].drawdownPct;
      if (v < min) min = v;
    }
    return min;
  }, [points]);

  const endingEquity = points.length ? points[points.length - 1].equity : initialCapital;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PanelShell
          title="Equity Curve"
          subtitle={`End: $${endingEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        >
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : equityPoints.length ? (
            <EquityCurve points={equityPoints} initialCapital={initialCapital} />
          ) : (
            <EmptyChartState label="No equity points available" />
          )}
        </PanelShell>
      </div>
      <div className="lg:col-span-2">
        <PanelShell title="Drawdown" subtitle={`Max: ${Math.abs(maxDrawdown).toFixed(2)}%`}>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : drawdownPoints.length ? (
            <DrawdownChart points={drawdownPoints} />
          ) : (
            <EmptyChartState label="No drawdown data" />
          )}
        </PanelShell>
      </div>
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-[12px] text-text-muted">
      {label}
    </div>
  );
}
