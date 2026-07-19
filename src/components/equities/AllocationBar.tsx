'use client';

import { useChartTheme } from '@/lib/charts/useChartTheme';
import type { SleeveTarget } from '@/types/equity';

interface AllocationBarProps {
  targets: SleeveTarget[];
}

/** Horizontal stacked bar showing per-sleeve target weights. Colors from useChartTheme — no hardcoded hex. */
export function AllocationBar({ targets }: AllocationBarProps) {
  const { CHART_COLORS } = useChartTheme();

  if (targets.length === 0) return null;

  // Group by sleeveCode and sum absolute weights per sleeve
  const sleeveTotals = targets.reduce<Record<string, number>>((acc, t) => {
    acc[t.sleeveCode] = (acc[t.sleeveCode] ?? 0) + Math.abs(t.targetWeight);
    return acc;
  }, {});

  const sleeves = Object.entries(sleeveTotals);
  const totalWeight = sleeves.reduce((s, [, w]) => s + w, 0);

  // Cycle through chart colors
  const COLORS = [
    CHART_COLORS.info,
    CHART_COLORS.profit,
    CHART_COLORS.warning,
    CHART_COLORS.neutral,
    CHART_COLORS.loss,
    CHART_COLORS.profitBright,
    CHART_COLORS.neutralDim,
  ];

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">
        Sleeve allocation
      </div>
      {/* Stacked bar */}
      <div
        aria-label="Sleeve allocation bar"
        className="flex h-6 w-full overflow-hidden rounded-md"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {sleeves.map(([sleeveCode, weight], i) => {
          const pct = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
          return (
            <div
              key={sleeveCode}
              title={`${sleeveCode}: ${(weight * 100).toFixed(1)}%`}
              style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {sleeves.map(([sleeveCode, weight], i) => (
          <div key={sleeveCode} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="font-mono text-[13px] text-[var(--text-secondary)]">
              {sleeveCode}{' '}
              <span className="text-[var(--text-muted)]">{(weight * 100).toFixed(1)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
