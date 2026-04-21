import { cn } from '@/lib/utils';
import type { ChartInterval } from '@/hooks/useMarketChart';

const INTERVALS: ChartInterval[] = ['5m', '15m', '1h', '4h'];

interface IntervalTabsProps {
  value: ChartInterval;
  onChange: (iv: ChartInterval) => void;
}

export function IntervalTabs({ value, onChange }: IntervalTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Chart interval"
      className="flex items-center gap-0.5 rounded-md bg-[var(--bg-overlay)] p-0.5"
    >
      {INTERVALS.map((iv) => {
        const active = iv === value;
        return (
          <button
            key={iv}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(iv)}
            className={cn(
              'rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors duration-150',
              active
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
            )}
          >
            {iv}
          </button>
        );
      })}
    </div>
  );
}
