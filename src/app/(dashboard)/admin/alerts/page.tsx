'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, Loader2, RefreshCcw, Search, ShieldAlert } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useDebouncedSearchPage } from '@/hooks/useDebouncedSearchPage';
import { formatDate } from '@/lib/formatters';
import { listAlerts, type AlertEvent, type AlertSeverity } from '@/lib/api/alerts';

const PAGE_SIZE = 50;

const SEVERITY_FILTERS: { label: string; value: AlertSeverity | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'Warn', value: 'WARN' },
  { label: 'Info', value: 'INFO' },
];

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Newest first', value: 'createdAt,desc' },
  { label: 'Oldest first', value: 'createdAt,asc' },
  { label: 'Severity ↓ (critical first)', value: 'severity,desc' },
  { label: 'Severity ↑ (info first)', value: 'severity,asc' },
];

export default function AdminAlertsPage() {
  const isAdmin = useIsAdmin();
  const [severity, setSeverity] = useState<AlertSeverity | 'ALL'>('ALL');
  const [includeSuppressed, setIncludeSuppressed] = useState(false);
  const [sort, setSort] = useState('createdAt,desc');
  const { searchInput, setSearchInput, debouncedSearch, page, setPage } = useDebouncedSearchPage();

  const query = useQuery({
    queryKey: ['alerts', severity, includeSuppressed, sort, debouncedSearch, page],
    queryFn: () =>
      listAlerts({
        severity: severity === 'ALL' ? undefined : severity,
        includeSuppressed,
        search: debouncedSearch || undefined,
        sort,
        page,
        size: PAGE_SIZE,
      }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <div className="px-6 py-12 text-center text-text-secondary">Admin access required.</div>;
  }

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const totalElements = query.data?.totalElements ?? 0;

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">Alerts</h1>
          <p className="text-sm text-text-secondary">
            Operational alert feed — kill-switch trips, ingest stalls, P&amp;L deviation, verdict
            drift. Same rows raised by Telegram / email.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mm-pill"
          style={{ padding: '8px 12px', fontSize: 12 }}
          aria-label="Refresh alerts"
        >
          {query.isFetching && !query.isLoading ? (
            <Loader2 size={13} strokeWidth={1.7} className="animate-spin" />
          ) : (
            <RefreshCcw size={13} strokeWidth={1.7} />
          )}
          <span>Refresh</span>
        </button>
      </header>

      {/* Filter bar */}
      <div className="flex flex-col gap-2 rounded-md border border-bd-subtle bg-bg-surface px-3 py-2.5">
        {/* Search */}
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] uppercase tracking-widest text-text-muted">
            Search
          </span>
          <div className="relative">
            <Search
              size={11}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="message or kind…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-7 w-64 rounded-sm border border-bd-subtle bg-bg-elevated pl-6 pr-2 font-mono text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>
        </div>

        {/* Severity */}
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-[11px] uppercase tracking-widest text-text-muted">
            Severity
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {SEVERITY_FILTERS.map((f) => {
              const active = severity === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    setSeverity(f.value);
                    setPage(0);
                  }}
                  className="rounded-sm px-2 py-1 text-[12px] transition-colors"
                  style={{
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: active ? 'var(--border-default)' : 'transparent',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort + suppressed + count */}
        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-[11px] uppercase tracking-widest text-text-muted">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
            className="h-7 rounded-sm border border-bd-subtle bg-bg-elevated px-2 font-mono text-[12px] text-text-primary"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <span className="mx-1 h-4 w-px bg-bd-subtle" />

          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-text-secondary">
            <input
              type="checkbox"
              checked={includeSuppressed}
              onChange={(e) => {
                setIncludeSuppressed(e.target.checked);
                setPage(0);
              }}
            />
            Show suppressed
          </label>

          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {totalElements} {totalElements === 1 ? 'event' : 'events'}
          </span>
        </div>
      </div>

      {/* Feed */}
      {query.isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-text-secondary">
          No alerts match the current filters.
        </div>
      ) : (
        <ul className="divide-y divide-bd-subtle rounded-md border border-bd-subtle bg-bg-surface">
          {rows.map((r) => (
            <AlertRow key={r.alertEventId} alert={r} />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-text-muted">
          <span>
            {totalElements} event{totalElements !== 1 ? 's' : ''} · page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page <= 0}
              className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
              style={{ padding: '6px 10px', fontSize: 12 }}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
              style={{ padding: '6px 10px', fontSize: 12 }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertEvent }) {
  const sev = severityMeta(alert.severity);
  const Icon = sev.icon;
  const ts = alert.createdAt ? new Date(alert.createdAt).getTime() : null;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
        style={{ background: sev.bg, color: sev.fg }}
      >
        <Icon size={14} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: sev.fg }}
          >
            {alert.severity}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {alert.kind}
          </span>
          {alert.suppressed && (
            <span className="rounded-sm bg-bg-hover px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-muted">
              suppressed
            </span>
          )}
          <span className="ml-auto font-mono text-[10px] text-text-muted">
            {ts ? formatDate(ts) : '—'}
          </span>
        </div>
        <p className="mt-1 text-[12px] text-text-primary">{alert.message}</p>
        {alert.dedupeKey && (
          <p className="mt-1 font-mono text-[10px] text-text-muted">dedupe: {alert.dedupeKey}</p>
        )}
        {alert.context != null && (
          <pre className="mt-1.5 max-h-40 overflow-auto rounded-sm bg-bg-base p-2 font-mono text-[10px] leading-tight text-text-secondary">
            {JSON.stringify(alert.context, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}

function severityMeta(s: AlertSeverity): {
  icon: React.ElementType;
  fg: string;
  bg: string;
} {
  switch (s) {
    case 'CRITICAL':
      return { icon: ShieldAlert, fg: 'var(--color-loss)', bg: 'rgba(255,77,106,0.15)' };
    case 'WARN':
      return { icon: AlertTriangle, fg: 'var(--color-warning)', bg: 'rgba(245,166,35,0.15)' };
    case 'INFO':
    default:
      return { icon: Info, fg: 'var(--color-info)', bg: 'rgba(78,158,255,0.15)' };
  }
}
