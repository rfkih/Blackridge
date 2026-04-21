import { cn } from '@/lib/utils';

interface BacktestParamDiffBadgeProps {
  overrideCount: number;
  className?: string;
}

export function BacktestParamDiffBadge({ overrideCount, className }: BacktestParamDiffBadgeProps) {
  const isDirty = overrideCount > 0;
  return (
    <span
      className={cn(
        'num inline-flex items-center gap-1 rounded-sm px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider',
        isDirty ? 'text-warning' : 'text-text-muted',
        className,
      )}
      style={{
        backgroundColor: isDirty ? 'var(--tint-warning)' : 'var(--bg-elevated)',
      }}
    >
      {isDirty ? (
        <>
          <span>{overrideCount}</span>
          <span>override{overrideCount === 1 ? '' : 's'}</span>
        </>
      ) : (
        <span>defaults</span>
      )}
    </span>
  );
}
