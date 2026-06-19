'use client';

interface PanelShellProps {
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/** Card shell shared by the hedging chart panels — matches the dashboard
 *  `br-card` header idiom so the empty-state and the plotted state look the
 *  same frame. */
export function PanelShell({ title, subtitle, headerRight, children }: PanelShellProps) {
  return (
    <div className="br-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div
            className="text-[14px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: 'var(--text-muted)' }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="mt-1 text-[14px]" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </div>
          )}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

/** Dashed empty-state used when a panel's data source is not available yet. */
export function PanelEmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '44px 16px',
        textAlign: 'center',
        border: '1px dashed var(--border-subtle)',
        borderRadius: 16,
        color: 'var(--text-muted)',
        fontSize: 14,
        minHeight: 180,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {message}
    </div>
  );
}
