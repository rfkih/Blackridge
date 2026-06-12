'use client';

import type { ChartIndicators, ChartIndicatorKey } from '@/types/market';
import { INDICATORS } from '@/lib/charts/indicatorConfig';

interface IndicatorBarProps {
  indicators: ChartIndicators;
  onToggle: (key: ChartIndicatorKey) => void;
}

export function IndicatorBar({ indicators, onToggle }: IndicatorBarProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 py-2"
      role="group"
      aria-label="Chart indicators"
    >
      {INDICATORS.map((ind) => {
        const active = indicators[ind.key];
        return (
          <button
            key={ind.key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(ind.key)}
            className={[
              'rounded border px-2 py-0.5 font-mono text-[11px] transition-colors',
              active
                ? 'border-transparent text-black'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]',
            ].join(' ')}
            style={active ? { backgroundColor: ind.color } : undefined}
          >
            {ind.label}
          </button>
        );
      })}
    </div>
  );
}
