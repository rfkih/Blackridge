'use client';

import { useState } from 'react';
import { useDebouncedSearchPage } from '@/hooks/useDebouncedSearchPage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { formatDate } from '@/lib/formatters';
import {
  getErrorLogRow,
  listErrorLog,
  updateErrorStatus,
  type ErrorLogRow,
  type ErrorSeverity,
  type ErrorStatus,
} from '@/lib/api/error-log';

const PAGE_SIZE = 50;

const SEVERITY_FILTERS: { label: string; value: ErrorSeverity | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'High', value: 'HIGH' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'Low', value: 'LOW' },
];

const STATUS_FILTERS: { label: string; value: ErrorStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'Investigating', value: 'INVESTIGATING' },
  { label: 'Resolved', value: 'RESOLVED' },
  { label: 'Ignored', value: 'IGNORED' },
  { label: "Won't fix", value: 'WONT_FIX' },
];

const JVM_FILTERS: { label: string; value: string | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Trading', value: 'trading' },
  { label: 'Research', value: 'research' },
  { label: 'Frontend', value: 'frontend' },
];

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Last seen ↓', value: 'lastSeenAt,desc' },
  { label: 'Last seen ↑', value: 'lastSeenAt,asc' },
  { label: 'First seen ↓', value: 'occurredAt,desc' },
  { label: 'Occurrences ↓', value: 'occurrenceCount,desc' },
  { label: 'Occurrences ↑', value: 'occurrenceCount,asc' },
];

export default function AdminErrorsPage() {
  const isAdmin = useIsAdmin();
  const [severity, setSeverity] = useState<ErrorSeverity | 'ALL'>('ALL');
  const [status, setStatus] = useState<ErrorStatus | 'ALL'>('NEW');
  const [jvm, setJvm] = useState<string | 'ALL'>('ALL');
  const [sort, setSort] = useState('lastSeenAt,desc');
  const { searchInput, setSearchInput, debouncedSearch, page, setPage } = useDebouncedSearchPage();

  const query = useQuery({
    queryKey: ['error-log', severity, status, jvm, sort, debouncedSearch, page],
    queryFn: () =>
      listErrorLog({
        severity: severity === 'ALL' ? undefined : severity,
        status: status === 'ALL' ? undefined : status,
        jvm: jvm === 'ALL' ? undefined : jvm,
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
          <h1 className="font-display text-2xl font-semibold text-text-primary">Errors</h1>
          <p className="text-sm text-text-secondary">
            Fingerprint-deduped error_log rows from both JVMs and the frontend. Repeats UPSERT into
            the open row; closing it lets the next occurrence reopen a fresh row.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mm-pill"
          style={{ padding: '8px 12px', fontSize: 12 }}
          aria-label="Refresh errors"
        >
          <RefreshCcw size={13} strokeWidth={1.7} />
          <span>Refresh</span>
        </button>
      </header>

      <div className="flex flex-col gap-2 rounded-xl border border-bd-subtle bg-bg-surface px-3 py-2.5">
        {}
        <div className="flex items-center gap-2">
          <span className="w-16 text-[11px] uppercase tracking-widest text-text-muted">Search</span>
          <div className="relative">
            <Search
              size={11}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="message, logger, exception…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-7 w-64 rounded-sm border border-bd-subtle bg-bg-base pl-6 pr-2 font-mono text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
          </div>
        </div>

        <FilterRow
          label="Severity"
          options={SEVERITY_FILTERS}
          active={severity}
          onChange={(v) => {
            setSeverity(v as ErrorSeverity | 'ALL');
            setPage(0);
          }}
        />
        <FilterRow
          label="Status"
          options={STATUS_FILTERS}
          active={status}
          onChange={(v) => {
            setStatus(v as ErrorStatus | 'ALL');
            setPage(0);
          }}
        />
        <FilterRow
          label="JVM"
          options={JVM_FILTERS}
          active={jvm}
          onChange={(v) => {
            setJvm(v);
            setPage(0);
          }}
        />

        {}
        <div className="flex items-center gap-2">
          <span className="w-16 text-[11px] uppercase tracking-widest text-text-muted">Sort</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
            className="h-7 rounded-sm border border-bd-subtle bg-bg-base px-2 font-mono text-[12px] text-text-primary"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {totalElements} {totalElements === 1 ? 'row' : 'rows'}
          </span>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-text-secondary">
          No error rows match the current filters.
        </div>
      ) : (
        <ul className="divide-y divide-bd-subtle rounded-xl border border-bd-subtle bg-bg-surface">
          {rows.map((r) => (
            <ErrorRowItem key={r.errorId} row={r} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
            className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            Prev
          </button>
          <span className="font-mono text-[11px] text-text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
            style={{ padding: '6px 10px', fontSize: 12 }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  active,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[11px] uppercase tracking-widest text-text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((f) => {
          const isActive = active === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => onChange(f.value)}
              className="rounded-sm px-2 py-1 text-[12px] transition-colors"
              style={{
                background: isActive ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-default)' : 'transparent',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ErrorRowItem({ row }: { row: ErrorLogRow }) {
  const [expanded, setExpanded] = useState(false);
  const sev = severityMeta(row.severity);
  const Icon = sev.icon;
  const ts = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : null;

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start gap-3">
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
              {row.severity}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
              {row.status}
            </span>
            <span className="rounded-sm bg-bg-hover px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-muted">
              {row.jvm}
            </span>
            {row.occurrenceCount > 1 && (
              <span className="font-mono text-[10px] text-text-muted">×{row.occurrenceCount}</span>
            )}
            <span className="ml-auto font-mono text-[10px] text-text-muted">
              {ts ? formatDate(ts) : '—'}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-text-primary">{row.message}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[10px] text-text-muted">
            <span>{row.loggerName}</span>
            {row.exceptionClass && <span>{row.exceptionClass}</span>}
            <span>fp:{row.fingerprint.slice(0, 12)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mm-pill"
          style={{ padding: '4px 8px', fontSize: 11 }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronDown size={12} strokeWidth={1.7} />
          ) : (
            <ChevronRight size={12} strokeWidth={1.7} />
          )}
          <span>{expanded ? 'Hide' : 'Inspect'}</span>
        </button>
      </div>
      {expanded && <ErrorRowDetail row={row} />}
    </li>
  );
}

function ErrorRowDetail({ row }: { row: ErrorLogRow }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ['error-log', 'detail', row.errorId],
    queryFn: () => getErrorLogRow(row.errorId),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (next: ErrorStatus) => updateErrorStatus(row.errorId, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-log'] });
    },
  });

  const detail = detailQuery.data;

  return (
    <div className="ml-10 flex flex-col gap-3 rounded-sm border border-bd-subtle bg-bg-base px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-text-muted">Set status</span>
        {(['NEW', 'INVESTIGATING', 'RESOLVED', 'IGNORED', 'WONT_FIX'] as const).map((s) => {
          const active = row.status === s;
          return (
            <button
              key={s}
              type="button"
              disabled={mutation.isPending || active}
              onClick={() => mutation.mutate(s)}
              className="rounded-sm px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: active ? 'var(--bg-hover)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: active ? 'var(--border-default)' : 'var(--border-subtle)',
              }}
            >
              {s.replace('_', ' ').toLowerCase()}
            </button>
          );
        })}
        {mutation.isPending && <Loader2 size={12} className="ml-1 animate-spin text-text-muted" />}
        {mutation.isError && (
          <span className="font-mono text-[10px] text-loss">
            {(mutation.error as Error).message}
          </span>
        )}
      </div>

      {row.resolvedAt && (
        <div className="font-mono text-[10px] text-text-muted">
          resolved {row.resolvedAt}
          {row.resolvedBy ? ` by ${row.resolvedBy}` : ''}
        </div>
      )}

      {detailQuery.isLoading ? (
        <div className="flex items-center gap-2 text-[11px] text-text-secondary">
          <Loader2 size={12} className="animate-spin" />
          <span>Loading stack trace…</span>
        </div>
      ) : detailQuery.isError || !detail ? (
        <div className="text-[11px] text-text-secondary">Could not load stack trace.</div>
      ) : (
        <>
          {detail.stackTrace && (
            <pre className="max-h-72 overflow-auto rounded-sm bg-bg-surface p-2 font-mono text-[10px] leading-tight text-text-secondary">
              {detail.stackTrace}
            </pre>
          )}
          {detail.mdc != null &&
            !(
              typeof detail.mdc === 'object' &&
              detail.mdc !== null &&
              Object.keys(detail.mdc as object).length === 0
            ) && (
              <div>
                <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  MDC
                </div>
                <pre className="max-h-40 overflow-auto rounded-sm bg-bg-surface p-2 font-mono text-[10px] leading-tight text-text-secondary">
                  {JSON.stringify(detail.mdc, null, 2)}
                </pre>
              </div>
            )}
          {detail.notificationChannels && detail.notificationChannels.length > 0 && (
            <div className="font-mono text-[10px] text-text-muted">
              notified via {detail.notificationChannels.join(', ')}
              {detail.notifiedAt ? ` at ${detail.notifiedAt}` : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function severityMeta(s: ErrorSeverity): {
  icon: React.ElementType;
  fg: string;
  bg: string;
} {
  switch (s) {
    case 'CRITICAL':
      return {
        icon: ShieldAlert,
        fg: 'var(--color-loss)',
        bg: 'rgba(229,72,77,0.15)',
      };
    case 'HIGH':
      return {
        icon: AlertOctagon,
        fg: 'var(--color-loss)',
        bg: 'rgba(229,72,77,0.10)',
      };
    case 'MEDIUM':
      return {
        icon: AlertTriangle,
        fg: 'var(--color-warning)',
        bg: 'rgba(245,166,35,0.15)',
      };
    case 'LOW':
    default:
      return {
        icon: Bug,
        fg: 'var(--color-info)',
        bg: 'rgba(59,130,246,0.12)',
      };
  }
}
