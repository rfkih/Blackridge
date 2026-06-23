'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { formatDate } from '@/lib/formatters';
import { listLoopReports, type LoopReportRow } from '@/lib/api/loop-reports';

const PAGE_SIZE = 20;

const TYPE_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Daily', value: 'DAILY' },
  { label: 'Exec health', value: 'EXEC_HEALTH' },
  { label: 'Ad-hoc', value: 'ADHOC' },
];

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'OK', value: 'OK' },
  { label: 'Warn', value: 'WARN' },
  { label: 'Critical', value: 'CRITICAL' },
];

const SORT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Newest', value: 'createdTime,desc' },
  { label: 'Oldest', value: 'createdTime,asc' },
  { label: 'Report date ↓', value: 'reportDate,desc' },
  { label: 'Report date ↑', value: 'reportDate,asc' },
];

export default function AdminLoopReportsPage() {
  const isAdmin = useIsAdmin();
  const [reportType, setReportType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('createdTime,desc');
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ['loop-reports', reportType, status, sort, page],
    queryFn: () =>
      listLoopReports({
        reportType: reportType === 'ALL' ? undefined : reportType,
        status: status === 'ALL' ? undefined : status,
        sort,
        page,
        size: PAGE_SIZE,
      }),
    staleTime: 30_000,
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
          <h1 className="font-display text-2xl font-semibold text-text-primary">Loop Reports</h1>
          <p className="text-sm text-text-secondary">
            Durable history of the self-improvement loop&apos;s daily and execution-health digests —
            trades, failed executions, carry P&amp;L, research progress, and graduation candidates,
            captured each cycle.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mm-pill"
          style={{ padding: '8px 12px', fontSize: 14 }}
          aria-label="Refresh reports"
        >
          <RefreshCcw size={13} strokeWidth={1.7} />
          <span>Refresh</span>
        </button>
      </header>

      <div className="flex flex-col gap-2 rounded-xl border border-bd-subtle bg-bg-surface px-3 py-2.5">
        <FilterRow
          label="Type"
          options={TYPE_FILTERS}
          active={reportType}
          onChange={(v) => {
            setReportType(v);
            setPage(0);
          }}
        />
        <FilterRow
          label="Status"
          options={STATUS_FILTERS}
          active={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
        />
        <div className="flex items-center gap-2">
          <span className="w-16 text-[13px] uppercase tracking-widest text-text-muted">Sort</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
            className="h-7 rounded-sm border border-bd-subtle bg-bg-base px-2 font-mono text-[14px] text-text-primary"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="ml-auto font-mono text-[12px] uppercase tracking-widest text-text-muted">
            {totalElements} {totalElements === 1 ? 'report' : 'reports'}
          </span>
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-text-secondary">
          No reports yet. The loop writes one here each cycle.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <ReportCard key={r.id} row={r} />
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
            style={{ padding: '6px 10px', fontSize: 14 }}
          >
            Prev
          </button>
          <span className="font-mono text-[13px] text-text-muted">
            Page {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
            style={{ padding: '6px 10px', fontSize: 14 }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  active,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 text-[13px] uppercase tracking-widest text-text-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((f) => {
          const isActive = active === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => onChange(f.value)}
              className="rounded-sm px-2 py-1 text-[14px] transition-colors"
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

function ReportCard({ row }: { row: LoopReportRow }) {
  const [expanded, setExpanded] = useState(false);
  const st = statusMeta(row.status);
  const Icon = st.icon;
  const created = row.createdAt ? formatDate(new Date(row.createdAt).getTime()) : null;
  const metricEntries = row.metrics ? Object.entries(row.metrics) : [];

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-bd-subtle bg-bg-surface px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
          style={{ background: st.bg, color: st.fg }}
        >
          <Icon size={14} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className="font-mono text-[12px] uppercase tracking-widest"
              style={{ color: st.fg }}
            >
              {st.label}
            </span>
            <span className="rounded-sm bg-bg-hover px-1.5 py-px font-mono text-[12px] uppercase tracking-widest text-text-muted">
              {row.reportType}
            </span>
            <span className="font-mono text-[12px] text-text-muted">{row.reportDate}</span>
            <span className="ml-auto font-mono text-[12px] text-text-muted">{created ?? '—'}</span>
          </div>
          <p className="mt-1 text-[15px] font-medium text-text-primary">{row.title}</p>
          {row.summary && (
            <p className="mt-0.5 text-[14px] text-text-secondary">{row.summary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mm-pill"
          style={{ padding: '4px 8px', fontSize: 13 }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronDown size={12} strokeWidth={1.7} />
          ) : (
            <ChevronRight size={12} strokeWidth={1.7} />
          )}
          <span>{expanded ? 'Hide' : 'Open'}</span>
        </button>
      </div>

      {expanded && (
        <div className="ml-10 flex flex-col gap-3">
          {metricEntries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {metricEntries.map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-col gap-0.5 rounded-sm border border-bd-subtle bg-bg-base px-2.5 py-1.5"
                >
                  <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                    {prettifyKey(k)}
                  </span>
                  <span className="font-mono text-[14px] tabular-nums text-text-primary">
                    {formatMetric(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {row.body ? (
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-sm border border-bd-subtle bg-bg-base p-3 font-mono text-[13px] leading-relaxed text-text-secondary">
              {row.body}
            </pre>
          ) : (
            <div className="text-[13px] text-text-muted">No detailed body for this report.</div>
          )}
          {row.createdBy && (
            <div className="font-mono text-[12px] text-text-muted">written by {row.createdBy}</div>
          )}
        </div>
      )}
    </li>
  );
}

function statusMeta(status: string): {
  label: string;
  icon: React.ElementType;
  fg: string;
  bg: string;
} {
  switch ((status ?? '').toUpperCase()) {
    case 'CRITICAL':
      return {
        label: 'Critical',
        icon: ShieldAlert,
        fg: 'var(--color-loss)',
        bg: 'rgba(229,72,77,0.15)',
      };
    case 'WARN':
      return {
        label: 'Warn',
        icon: TriangleAlert,
        fg: 'var(--color-warning)',
        bg: 'rgba(245,166,35,0.15)',
      };
    case 'OK':
    default:
      return {
        label: status ? 'OK' : '—',
        icon: CheckCircle2,
        fg: 'var(--color-profit)',
        bg: 'rgba(34,197,94,0.13)',
      };
  }
}

function prettifyKey(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatMetric(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}
