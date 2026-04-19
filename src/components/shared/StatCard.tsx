import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type ValueColor = 'profit' | 'loss' | 'info' | 'warning' | 'neutral';

interface StatCardProps {
  label: string;
  value: string;
  valueColor?: ValueColor;
  sub?: string;
  subColor?: 'profit' | 'loss' | 'neutral';
  icon?: React.ElementType;
  isLoading?: boolean;
  className?: string;
}

const VALUE_COLOR_MAP: Record<ValueColor, string> = {
  profit: 'var(--color-profit)',
  loss: 'var(--color-loss)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  neutral: 'var(--text-primary)',
};

const SUB_COLOR_MAP = {
  profit: 'var(--color-profit)',
  loss: 'var(--color-loss)',
  neutral: 'var(--text-muted)',
};

export function StatCard({
  label,
  value,
  valueColor = 'neutral',
  sub,
  subColor = 'neutral',
  icon: Icon,
  isLoading,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </span>
        {Icon && (
          <span className="rounded-md bg-[var(--bg-elevated)] p-1.5">
            <Icon size={13} className="text-[var(--text-muted)]" />
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          {sub !== undefined && <Skeleton className="h-3.5 w-20" />}
        </div>
      ) : (
        <div>
          <span
            className="font-display text-2xl font-semibold leading-none tabular-nums tracking-tight"
            style={{ color: VALUE_COLOR_MAP[valueColor] }}
          >
            {value}
          </span>
          {sub && (
            <p
              className="mt-1.5 text-[11px] tabular-nums"
              style={{ color: SUB_COLOR_MAP[subColor] }}
            >
              {sub}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
