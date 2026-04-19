import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {Icon && (
        <div className="mb-4 rounded-full bg-[var(--bg-elevated)] p-3">
          <Icon size={20} className="text-[var(--text-muted)]" />
        </div>
      )}
      <p className="text-sm font-medium text-[var(--text-secondary)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
