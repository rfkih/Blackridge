import { cn } from '@/lib/utils';
import type { ActiveIndicators } from '@/hooks/useMarketChart';
import { INDICATOR_COLORS } from '@/lib/charts/chartTheme';

interface IndicatorDef {
  key: keyof ActiveIndicators;
  label: string;
  color: string;
}

const INDICATORS: IndicatorDef[] = [
  { key: 'ema20', label: 'EMA 20', color: INDICATOR_COLORS.ema20 },
  { key: 'ema50', label: 'EMA 50', color: INDICATOR_COLORS.ema50 },
  { key: 'ema200', label: 'EMA 200', color: INDICATOR_COLORS.ema200 },
  { key: 'bb', label: 'BB', color: INDICATOR_COLORS.bb },
  { key: 'kc', label: 'KC', color: INDICATOR_COLORS.kc },
  { key: 'vol', label: 'VOL', color: INDICATOR_COLORS.bb },
  { key: 'rsi', label: 'RSI', color: INDICATOR_COLORS.rsi },
  { key: 'macd', label: 'MACD', color: INDICATOR_COLORS.macdLine },
];

interface IndicatorToggleBarProps {
  indicators: ActiveIndicators;
  onToggle: (key: keyof ActiveIndicators) => void;
}

export function IndicatorToggleBar({ indicators, onToggle }: IndicatorToggleBarProps) {
  return (
    <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto px-4 py-2">
      {INDICATORS.map(({ key, label, color }) => {
        const active = indicators[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors duration-150',
              active
                ? 'text-[var(--text-primary)]'
                : 'border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]',
            )}
            style={
              active
                ? {
                    borderColor: color,
                    backgroundColor: `${color}1A`,
                    color,
                  }
                : undefined
            }
          >
            {active && (
              <span
                className="inline-block h-2 w-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
