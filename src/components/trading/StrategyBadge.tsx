import { cn } from '@/lib/utils';

interface StrategyColors {
  bg: string;
  text: string;
  border: string;
}

const STRATEGY_COLOR_MAP: Record<string, StrategyColors> = {
  LSR: {
    bg: 'rgba(78,158,255,0.1)',
    text: '#4E9EFF',
    border: 'rgba(78,158,255,0.25)',
  },
  LSR_V2: {
    bg: 'rgba(78,158,255,0.1)',
    text: '#4E9EFF',
    border: 'rgba(78,158,255,0.25)',
  },
  VCB: {
    bg: 'rgba(245,166,35,0.1)',
    text: '#F5A623',
    border: 'rgba(245,166,35,0.25)',
  },
  TREND_PULLBACK_SINGLE_EXIT: {
    bg: 'rgba(0,200,150,0.1)',
    text: '#00C896',
    border: 'rgba(0,200,150,0.25)',
  },
  RAHT_V1: {
    bg: 'rgba(180,100,255,0.1)',
    text: '#B464FF',
    border: 'rgba(180,100,255,0.25)',
  },
  TSMOM_V1: {
    bg: 'rgba(0,210,210,0.1)',
    text: '#00D2D2',
    border: 'rgba(0,210,210,0.25)',
  },
};

const DEFAULT_COLORS: StrategyColors = {
  bg: 'rgba(136,146,164,0.1)',
  text: '#8892A4',
  border: 'rgba(136,146,164,0.25)',
};

interface StrategyBadgeProps {
  code: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StrategyBadge({ code, size = 'md', className }: StrategyBadgeProps) {
  const colors = STRATEGY_COLOR_MAP[code] ?? DEFAULT_COLORS;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded font-mono font-semibold tracking-wider',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        className,
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {code}
    </span>
  );
}
