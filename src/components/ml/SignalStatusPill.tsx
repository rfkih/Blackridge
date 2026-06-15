import { cn } from '@/lib/utils';
import type { SignalStatus } from '@/types/ml';

const STATUS_STYLES: Record<SignalStatus, string> = {
  active: 'bg-tint-profit text-profit ring-1 ring-profit',
  shadow: 'bg-tint-warning text-warning ring-1 ring-warning',
  retired: 'bg-bg-overlay text-text-secondary ring-1 ring-bd',
};

const STATUS_LABELS: Record<SignalStatus, string> = {
  active: 'live',
  shadow: 'shadow',
  retired: 'retired',
};

export function SignalStatusPill({
  status,
  className,
}: {
  status: SignalStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' && 'bg-profit',
          status === 'shadow' && 'bg-warning',
          status === 'retired' && 'bg-neutral',
        )}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
