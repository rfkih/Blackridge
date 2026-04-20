import { cn } from '@/lib/utils';

interface ChartPanelShellProps {
  title?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartPanelShell({
  title,
  headerLeft,
  headerRight,
  children,
  className,
}: ChartPanelShellProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-panel)' }}
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-3">
          {title && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              {title}
            </span>
          )}
          {headerLeft}
        </div>
        <div className="flex items-center gap-3">{headerRight}</div>
      </div>
      {children}
    </div>
  );
}
