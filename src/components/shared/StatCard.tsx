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
        'group relative flex flex-col gap-3 overflow-hidden rounded-md border border-bd-subtle bg-bg-surface px-4 py-4',
        'transition-colors duration-base ease-out-quart hover:border-bd',
        className,
      )}
    >
      <span aria-hidden="true" className="card-topline" />

      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        {Icon && (
          <Icon size={13} strokeWidth={1.75} className="text-text-muted" aria-hidden="true" />
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          {sub !== undefined && <Skeleton className="h-3 w-16" />}
        </div>
      ) : (
        <div>
          <span
            className="num block text-[26px] font-semibold leading-none tracking-tighter"
            style={{ color: VALUE_COLOR_MAP[valueColor] }}
          >
            {value}
          </span>
          {sub && (
            <p className="num mt-2 text-[11px] leading-none" style={{ color: SUB_COLOR_MAP[subColor] }}>
              {sub}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
