'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, MailOpen, CheckCircle2, RefreshCcw } from 'lucide-react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { formatDate } from '@/lib/formatters';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import {
  listSupportMessages,
  updateSupportMessageStatus,
  type SupportMessage,
  type SupportMessageStatus,
} from '@/lib/api/support';

const PAGE_SIZE = 25;
const STATUS_FILTERS: { label: string; value: SupportMessageStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'Read', value: 'READ' },
  { label: 'Resolved', value: 'RESOLVED' },
];

export default function AdminInboxPage() {
  const isAdmin = useIsAdmin();
  const [filter, setFilter] = useState<SupportMessageStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['support-inbox', filter, page],
    queryFn: () => listSupportMessages(page, PAGE_SIZE, filter === 'ALL' ? undefined : filter),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
    enabled: isAdmin,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportMessageStatus }) =>
      updateSupportMessageStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-inbox'] });
    },
    onError: (err) => {
      toast.error({ title: 'Could not update', description: normalizeError(err) });
    },
  });

  if (!isAdmin) {
    return (
      <section className="mm-card" style={{ padding: 32 }}>
        <h2 className="font-display" style={{ fontSize: 18, color: 'var(--mm-ink-0)' }}>
          Inbox
        </h2>
        <p style={{ marginTop: 8, fontSize: 13, color: 'var(--mm-ink-2)' }}>
          Admin only. Sign in as an admin to read support messages.
        </p>
      </section>
    );
  }

  const data = query.data;
  const messages = data?.content ?? [];
  const total = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const unread = data?.unreadCount ?? 0;

  return (
    <section
      className="mm-card"
      style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 className="font-display" style={{ fontSize: 22, color: 'var(--mm-ink-0)' }}>
            Inbox
          </h2>
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--mm-ink-2)' }}>
            Support messages submitted from Settings → Help &amp; support.{' '}
            {unread > 0 ? (
              <strong style={{ color: 'var(--color-warning)' }}>{unread} unread</strong>
            ) : (
              <span>No unread messages.</span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="mm-btn mm-btn-ghost"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {query.isFetching ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCcw size={12} />
          )}
          Refresh
        </button>
      </header>

      {/* Filter chips */}
      <div role="tablist" aria-label="Status filter" style={{ display: 'flex', gap: 6 }}>
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setFilter(f.value);
                setPage(0);
              }}
              className={active ? 'mm-pill mm-pill-mint' : 'mm-pill'}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {query.isLoading && messages.length === 0 ? (
        <div style={{ padding: 24, fontSize: 12, color: 'var(--mm-ink-2)', textAlign: 'center' }}>
          Loading messages…
        </div>
      ) : query.isError ? (
        <div
          role="alert"
          style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid rgba(255,77,106,0.40)',
            background: 'rgba(255,77,106,0.08)',
            fontSize: 12,
            color: 'var(--color-loss)',
          }}
        >
          Could not load inbox. Try again in a moment.
        </div>
      ) : messages.length === 0 ? (
        <div
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            border: '1px dashed var(--mm-border)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--mm-ink-2)',
          }}
        >
          No messages match this filter.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m) => (
            <MessageRow
              key={m.supportMessageId}
              message={m}
              expanded={expanded === m.supportMessageId}
              onToggle={() => setExpanded((cur) => (cur === m.supportMessageId ? null : m.supportMessageId))}
              onMarkRead={() =>
                mutation.mutate({ id: m.supportMessageId, status: 'READ' })
              }
              onMarkResolved={() =>
                mutation.mutate({ id: m.supportMessageId, status: 'RESOLVED' })
              }
              onReopen={() =>
                mutation.mutate({ id: m.supportMessageId, status: 'NEW' })
              }
              busy={mutation.isPending}
            />
          ))}
        </ul>
      )}

      {/* Footer */}
      {messages.length > 0 && (
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--mm-ink-2)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + messages.length} of {total}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="mm-btn"
              disabled={page === 0 || query.isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="mm-btn"
              disabled={page + 1 >= totalPages || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}

interface MessageRowProps {
  message: SupportMessage;
  expanded: boolean;
  onToggle: () => void;
  onMarkRead: () => void;
  onMarkResolved: () => void;
  onReopen: () => void;
  busy: boolean;
}

function MessageRow({
  message,
  expanded,
  onToggle,
  onMarkRead,
  onMarkResolved,
  onReopen,
  busy,
}: MessageRowProps) {
  const isNew = message.status === 'NEW';
  const isResolved = message.status === 'RESOLVED';
  const created = new Date(message.createdAt).getTime();
  const tone = STATUS_TONE[message.status];

  return (
    <li
      style={{
        padding: '14px 16px',
        borderRadius: 10,
        border: `1px solid ${isNew ? 'rgba(245,166,35,0.32)' : 'var(--mm-hair)'}`,
        background: isNew ? 'rgba(245,166,35,0.04)' : 'var(--mm-surface-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto auto',
          gap: 12,
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          color: 'inherit',
          width: '100%',
        }}
        aria-expanded={expanded}
      >
        <span aria-hidden="true" style={{ color: 'var(--mm-ink-2)' }}>
          {isNew ? <Mail size={14} /> : <MailOpen size={14} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: isNew ? 600 : 500,
              color: 'var(--mm-ink-0)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {message.subject}
          </div>
          <div
            className="font-mono"
            style={{
              marginTop: 2,
              fontSize: 11,
              color: 'var(--mm-ink-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {message.fromEmail}
          </div>
        </div>
        <span
          className="mm-chip"
          style={{
            fontSize: 9,
            letterSpacing: '0.16em',
            padding: '2px 8px',
            borderRadius: 999,
            background: tone.bg,
            color: tone.fg,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {message.status}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: 10, color: 'var(--mm-ink-3)', whiteSpace: 'nowrap' }}
        >
          {formatDate(created)}
        </span>
      </button>

      {expanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingTop: 4,
            borderTop: '1px solid var(--mm-hair)',
          }}
        >
          <div>
            <div
              className="mm-kicker"
              style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--mm-ink-3)' }}
            >
              MESSAGE
            </div>
            <p
              style={{
                marginTop: 4,
                fontSize: 13,
                color: 'var(--mm-ink-1)',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}
            >
              {message.body}
            </p>
          </div>

          {message.diagnostic && (
            <details>
              <summary
                className="mm-kicker"
                style={{
                  cursor: 'pointer',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  color: 'var(--mm-ink-3)',
                }}
              >
                DIAGNOSTIC
              </summary>
              <pre
                style={{
                  marginTop: 8,
                  padding: 10,
                  background: 'var(--mm-surface-3)',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--mm-ink-1)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {message.diagnostic}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <a
              className="mm-btn mm-btn-ghost"
              href={`mailto:${message.fromEmail}?subject=Re: ${encodeURIComponent(message.subject)}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            >
              <Mail size={12} /> Reply via email
            </a>
            {isNew && (
              <button
                type="button"
                className="mm-btn"
                disabled={busy}
                onClick={onMarkRead}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <MailOpen size={12} /> Mark read
              </button>
            )}
            {!isResolved && (
              <button
                type="button"
                className="mm-btn mm-btn-mint"
                disabled={busy}
                onClick={onMarkResolved}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <CheckCircle2 size={12} /> Resolve
              </button>
            )}
            {isResolved && (
              <button
                type="button"
                className="mm-btn mm-btn-ghost"
                disabled={busy}
                onClick={onReopen}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                Reopen
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

const STATUS_TONE: Record<SupportMessageStatus, { bg: string; fg: string }> = {
  NEW: { bg: 'rgba(245,166,35,0.16)', fg: 'var(--color-warning)' },
  READ: { bg: 'rgba(78,158,255,0.14)', fg: 'var(--color-info)' },
  RESOLVED: { bg: 'rgba(0,200,150,0.14)', fg: 'var(--color-profit)' },
};
