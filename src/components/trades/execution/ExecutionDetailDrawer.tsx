'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Copy, CheckCheck, ExternalLink, Info, X } from 'lucide-react';
import { format } from 'date-fns';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';
import { CATEGORY_LABEL } from './FailureBreakdownPanel';

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span style={{ color: 'var(--mm-ink-3)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: 'var(--mm-ink-1)', textAlign: 'right' }}>{children}</span>
    </div>
  );
}

export function ExecutionDetailDrawer({
  event,
  onClose,
}: {
  event: ExecutionEvent | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!event) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event, onClose]);

  if (!event) return null;

  const failed = event.status === 'FAILED';
  const accent = failed ? '#ef4444' : '#22c55e';
  const title = failed
    ? event.executionType === 'OPEN'
      ? 'Open failed'
      : 'Close failed'
    : event.executionType === 'OPEN'
      ? 'Opened'
      : 'Closed';

  const when = (() => {
    const d = new Date(event.executedAt);
    return Number.isNaN(d.getTime()) ? event.executedAt : format(d, 'yyyy-MM-dd HH:mm:ss');
  })();

  const copyError = async () => {
    try {
      await navigator.clipboard.writeText(event.errorMessage ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      {/* scrim */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="animate-in fade-in"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
      />

      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Execution detail"
        className="animate-in slide-in-from-right-8 duration-200"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(440px, 94vw)',
          background: 'var(--mm-card)',
          borderLeft: '1px solid var(--mm-hair)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* status header band */}
        <div
          style={{
            flexShrink: 0,
            padding: '14px 16px',
            borderBottom: `1px solid ${failed ? '#2a1d22' : '#1b2a1f'}`,
            background: failed
              ? 'linear-gradient(180deg, rgba(239,68,68,0.14), rgba(239,68,68,0.03))'
              : 'linear-gradient(180deg, rgba(34,197,94,0.12), rgba(34,197,94,0.02))',
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: failed ? 'rgba(239,68,68,0.16)' : 'rgba(34,197,94,0.16)',
                  color: accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {failed ? <AlertTriangle size={16} /> : <Check size={16} />}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--mm-ink-0)' }}>{title}</div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--mm-ink-2)',
                    fontFamily: 'var(--font-mono, ui-monospace)',
                  }}
                >
                  {event.asset} · {event.strategyName}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mm-ink-2)' }}
            >
              <X size={16} />
            </button>
          </div>
          {failed && event.failureCategory && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                marginTop: 10,
                background: 'rgba(239,68,68,0.16)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 999,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              ● {CATEGORY_LABEL[event.failureCategory]}
            </span>
          )}
        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* error hero */}
          {failed && event.errorMessage && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--mm-hair)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 7 }}>
                <span className="mm-kicker" style={{ fontSize: 10 }}>
                  Error message
                </span>
                <button
                  type="button"
                  onClick={copyError}
                  aria-label="Copy error message"
                  style={{
                    display: 'inline-flex',
                    gap: 4,
                    alignItems: 'center',
                    color: 'var(--mm-ink-2)',
                    fontSize: 11,
                    border: '1px solid var(--mm-hair-2, #2a3140)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {copied ? (
                    <>
                      <CheckCheck size={12} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy
                    </>
                  )}
                </button>
              </div>
              <div
                style={{
                  background: '#0a0c10',
                  border: '1px solid #2a1d22',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontFamily: 'var(--font-mono, ui-monospace)',
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  color: '#e5a3a3',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {event.errorMessage}
              </div>
            </div>
          )}

          {/* context rows */}
          <div
            style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 9, fontSize: 12.5 }}
          >
            <MetaRow label="Side">
              <span style={{ color: event.side === 'SHORT' ? 'var(--mm-dn)' : 'var(--mm-up)', fontWeight: 500 }}>
                {event.side ?? '—'}
                {event.side === 'LONG' ? ' ↑' : event.side === 'SHORT' ? ' ↓' : ''}
              </span>
            </MetaRow>
            <MetaRow label="Type">{event.executionType}</MetaRow>
            {event.strategyName && (
              <MetaRow label="Strategy">
                <span
                  style={{
                    background: 'var(--mm-surface-2)',
                    border: '1px solid var(--mm-hair-2, #2a3140)',
                    borderRadius: 6,
                    padding: '1px 8px',
                    fontFamily: 'var(--font-mono, ui-monospace)',
                    fontSize: 11,
                    color: 'var(--mm-ink-1)',
                  }}
                >
                  {event.strategyName}
                </span>
              </MetaRow>
            )}
            {event.executionReason && <MetaRow label="Signal">{event.executionReason}</MetaRow>}
            <MetaRow label="When">
              <span style={{ fontFamily: 'var(--font-mono, ui-monospace)' }}>{when}</span>
            </MetaRow>
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            flexShrink: 0,
            padding: '12px 16px',
            borderTop: '1px solid var(--mm-hair)',
            background: 'var(--mm-surface-2)',
          }}
        >
          {event.tradeId ? (
            <Link
              href={`/trades/${event.tradeId}`}
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'var(--color-info, #3b82f6)',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              View trade <ExternalLink size={13} />
            </Link>
          ) : (
            <div className="flex items-center gap-2" style={{ color: 'var(--mm-ink-2)', fontSize: 11.5 }}>
              <Info size={13} style={{ color: 'var(--mm-ink-3)', flexShrink: 0 }} />
              Rejected before a trade was created — no position opened.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
