'use client';

import { cn } from '@/lib/utils';

export interface StatusIndicatorProps {
  status: 'connected' | 'reconnecting' | 'disconnected';
  label?: string;
  size?: 'sm' | 'md';
}

const DOT_SIZE = { sm: 'size-1.5', md: 'size-2' };

export function StatusIndicator({ status, label, size = 'md' }: StatusIndicatorProps) {
  const dotClass = cn(DOT_SIZE[size], 'rounded-full shrink-0', {
    'bg-[var(--color-profit)]': status === 'connected',
    'bg-[var(--color-warning)] animate-pulse': status === 'reconnecting',
    'bg-[var(--color-loss)]': status === 'disconnected',
  });

  const labelText =
    label ??
    (status === 'connected' ? 'Live' : status === 'reconnecting' ? 'Reconnecting' : 'Offline');

  const labelColor =
    status === 'connected'
      ? 'text-[var(--color-profit)]'
      : status === 'reconnecting'
        ? 'text-[var(--color-warning)]'
        : 'text-[var(--color-loss)]';

  return (
    <div className="flex items-center gap-1.5">
      <span className={dotClass} aria-hidden="true" />
      <span className={cn('text-xs font-medium tabular-nums', labelColor)}>{labelText}</span>
    </div>
  );
}
