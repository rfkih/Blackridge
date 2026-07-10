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
        'inline-flex items-center rounded-full font-mono font-semibold uppercase tracking-wider',
        size === 'sm' ? 'px-2 py-0.5 text-[12px]' : 'px-2.5 py-[3px] text-[12px]',
        className,
      )}
      style={{
        // Token, not hex — --color-bot carries a light-mode variant.
        color: 'var(--color-bot)',
        backgroundColor: 'color-mix(in srgb, var(--color-bot) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-bot) 30%, transparent)',
      }}
    >
      RESEARCHER
    </span>
  );
});
