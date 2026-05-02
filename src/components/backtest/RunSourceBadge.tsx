import { memo } from 'react';
import { cn } from '@/lib/utils';

interface RunSourceBadgeProps {
  source: 'USER' | 'RESEARCHER' | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const RunSourceBadge = memo(function RunSourceBadge({
  source,
  size = 'sm',
  className,
}: RunSourceBadgeProps) {
  if (source !== 'RESEARCHER') return null;
  return (
    <span
      title="Submitted by the research-orchestrator agent"
      className={cn(
        'inline-flex items-center rounded-sm font-mono font-semibold uppercase tracking-wider',
        size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-[3px] text-[10px]',
        className,
      )}
      style={{
        color: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.12)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
      }}
    >
      RESEARCHER
    </span>
  );
});
