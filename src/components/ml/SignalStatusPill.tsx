import { cn } from '@/lib/utils';
import type { SignalStatus } from '@/types/ml';

const STATUS_STYLES: Record<SignalStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  shadow: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  retired: 'bg-zinc-600/20 text-zinc-400 ring-1 ring-zinc-600/30',
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
          status === 'active' && 'bg-emerald-400',
          status === 'shadow' && 'bg-amber-400',
          status === 'retired' && 'bg-zinc-500',
        )}
      />
      {STATUS_LABELS[status]}
    </span>
  );
}
