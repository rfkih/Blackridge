import { cn } from '@/lib/utils';
import type { AccountStrategyStatus } from '@/types/strategy';

interface StrategyStatusBadgeProps {
  status: AccountStrategyStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_CONFIG: Record<
  AccountStrategyStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  LIVE: {
    label: 'LIVE',
    dot: 'var(--color-profit)',
    text: 'var(--color-profit)',
    bg: 'rgba(0,200,150,0.12)',
  },
  PAUSED: {
    label: 'PAUSED',
    dot: 'var(--color-warning)',
    text: 'var(--color-warning)',
    bg: 'rgba(245,166,35,0.12)',
  },
  STOPPED: {
    label: 'STOPPED',
    dot: 'var(--color-loss)',
    text: 'var(--color-loss)',
    bg: 'rgba(255,77,106,0.12)',
  },
};

export function StrategyStatusBadge({ status, size = 'sm', className }: StrategyStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.STOPPED;
  const padY = size === 'sm' ? 'py-0.5' : 'py-1';
  const padX = size === 'sm' ? 'px-1.5' : 'px-2';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-semibold uppercase tracking-wider',
        padX,
        padY,
        textSize,
        className,
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span
        className={cn(
          'inline-block rounded-full',
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2',
          status === 'LIVE' ? 'animate-pulse' : '',
        )}
        style={{ backgroundColor: cfg.dot }}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}
