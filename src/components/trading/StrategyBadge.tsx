import { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Strategy-code color map. Values are CSS vars where possible so the badge
 * retints with the active theme; bespoke codes that don't have a token fall
 * back to a hand-tuned hex. Every hex here is tuned for MONO-MINT — do not
 * paste the old `#4E9EFF` / `#00C896` values back.
 */
interface StrategyColor {
  fg: string;
  bg: string;
  border: string;
}

const COLORS: Record<string, StrategyColor> = {
  LSR: {
    fg: 'var(--color-info)',
    bg: 'var(--tint-info)',
    border: 'color-mix(in oklab, var(--color-info) 30%, transparent)',
  },
  LSR_V2: {
    fg: 'var(--color-info)',
    bg: 'var(--tint-info)',
    border: 'color-mix(in oklab, var(--color-info) 30%, transparent)',
  },
  VCB: {
    fg: 'var(--color-warning)',
    bg: 'var(--tint-warning)',
    border: 'color-mix(in oklab, var(--color-warning) 30%, transparent)',
  },
  TREND_PULLBACK_SINGLE_EXIT: {
    fg: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.12)',
    border: 'rgba(168, 85, 247, 0.3)',
  },
  RAHT_V1: {
    fg: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.12)',
    border: 'rgba(236, 72, 153, 0.3)',
  },
  TSMOM_V1: {
    fg: '#14b8a6',
    bg: 'rgba(20, 184, 166, 0.12)',
    border: 'rgba(20, 184, 166, 0.3)',
  },
};

const DEFAULT_COLOR: StrategyColor = {
  fg: 'var(--text-secondary)',
  bg: 'var(--bg-elevated)',
  border: 'var(--border-default)',
};

interface StrategyBadgeProps {
  code: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StrategyBadge = memo(function StrategyBadge({
  code,
  size = 'md',
  className,
}: StrategyBadgeProps) {
  const c = COLORS[code] ?? DEFAULT_COLOR;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm font-mono font-semibold tracking-wider',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-[3px] text-[11px]',
        className,
      )}
      style={{ color: c.fg, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      {code}
    </span>
  );
});
