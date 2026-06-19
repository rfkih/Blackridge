'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCcw, ScrollText } from 'lucide-react';
import { listMyAuditEvents, type AuditEvent } from '@/lib/api/auditEvents';
import { formatDate } from '@/lib/formatters';

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ['audit-events', page],
    queryFn: () => listMyAuditEvents(page, PAGE_SIZE),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const rows = query.data?.content ?? [];
  const totalPages = query.data?.totalPages ?? 0;
  const totalElements = query.data?.totalElements ?? 0;

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-text-primary">Audit log</h1>
          <p className="text-sm text-text-secondary">
            Every security-sensitive action you&apos;ve taken — strategy CRUD, kill-switch rearm,
            account risk-config updates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => query.refetch()}
          className="mm-pill"
          style={{ padding: '8px 12px', fontSize: 14 }}
          aria-label="Refresh audit log"
        >
          <RefreshCcw size={13} strokeWidth={1.7} />
          <span>Refresh</span>
        </button>
      </header>

      {query.isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-bd-subtle bg-bg-surface px-6 py-12 text-center text-text-secondary">
          <ScrollText size={20} strokeWidth={1.5} className="mx-auto mb-2 text-text-muted" />
          No actions logged yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-bd-subtle bg-bg-surface">
          <table className="w-full text-[14px]">
            <thead>
              <tr
                className="text-left font-mono text-[12px] uppercase tracking-widest"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-muted)',
                }}
              >
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <AuditRow key={r.auditEventId} event={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between text-[13px] text-text-muted">
        <span className="font-mono">
          {totalElements} {totalElements === 1 ? 'event' : 'events'}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page <= 0}
              className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
              style={{ padding: '6px 10px', fontSize: 13 }}
            >
              Prev
            </button>
            <span className="font-mono">
              Page {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="mm-pill disabled:cursor-not-allowed disabled:opacity-50"
              style={{ padding: '6px 10px', fontSize: 13 }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditRow({ event }: { event: AuditEvent }) {
  const ts = event.createdAt ? new Date(event.createdAt).getTime() : null;
  return (
    <tr className="border-t border-bd-subtle">
      <td className="px-3 py-2 font-mono text-[13px] text-text-muted">
        {ts ? formatDate(ts) : '—'}
      </td>
      <td className="px-3 py-2 font-mono text-text-primary">{event.action}</td>
      <td className="px-3 py-2 font-mono text-[13px] text-text-secondary">
        {event.entityType ?? '—'}
        {event.entityId ? (
          <>
            <span className="text-text-muted"> · </span>
            <span className="text-text-muted">{event.entityId.slice(0, 8)}…</span>
          </>
        ) : null}
      </td>
      <td className="px-3 py-2 text-text-secondary">{event.reason ?? '—'}</td>
    </tr>
  );
}
