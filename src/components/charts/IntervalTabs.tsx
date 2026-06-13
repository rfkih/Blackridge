import { cn } from '@/lib/utils';
import type { ChartInterval } from '@/types/market';

const DEFAULT_INTERVALS: ChartInterval[] = ['5m', '15m', '1h', '4h'];

interface IntervalTabsProps {
  value: ChartInterval;
  onChange: (iv: ChartInterval) => void;
  /** Override the rendered interval set (e.g. the live-trades chart passes
   *  `['15m','1h','4h','1d']`). Defaults to the market-viewer set. */
  intervals?: ChartInterval[];
}

export function IntervalTabs({ value, onChange, intervals = DEFAULT_INTERVALS }: IntervalTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Chart interval"
      className="flex items-center gap-0.5 rounded-md bg-[var(--bg-overlay)] p-0.5"
    >
      {intervals.map((iv) => {
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
