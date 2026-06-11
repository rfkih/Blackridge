'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';
import { CATEGORY_LABEL } from './FailureBreakdownPanel';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span style={{ color: 'var(--mm-ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--mm-ink-1)' }}>{children}</span>
    </>
  );
}

export function ExecutionDetailDrawer({ event, onClose }: { event: ExecutionEvent | null; onClose: () => void }) {
  if (!event) return null;
  const when = (() => {
    const d = new Date(event.executedAt);
    return Number.isNaN(d.getTime()) ? event.executedAt : format(d, 'yyyy-MM-dd HH:mm:ss');
  })();

  return (
    <div role="dialog" aria-label="Execution detail"
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 92vw)', zIndex: 50,
        background: 'var(--mm-card)', borderLeft: '1px solid var(--mm-hair)', padding: 18, overflowY: 'auto' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="mm-kicker">Execution detail</div>
        <button type="button" onClick={onClose} aria-label="Close"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mm-ink-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 12.5 }}>
        <Row label="When">{when}</Row>
        <Row label="Status">
          <span style={{ color: event.status === 'FAILED' ? 'var(--mm-dn)' : 'var(--mm-up)' }}>{event.status}</span>
        </Row>
        {event.failureCategory && <Row label="Cause">{CATEGORY_LABEL[event.failureCategory]}</Row>}
        <Row label="Symbol · Strat">{event.asset} · {event.strategyName} · {event.executionType} {event.side}</Row>
        {event.executionReason && <Row label="Signal reason">{event.executionReason}</Row>}
        {event.errorMessage && <Row label="Raw error">{event.errorMessage}</Row>}
        <Row label="Trade">
          {event.tradeId
            ? <Link href={`/trades/${event.tradeId}`} style={{ color: 'var(--color-info)' }}>View trade →</Link>
            : <span style={{ color: 'var(--mm-ink-3)' }}>— rejected before a trade was created</span>}
        </Row>
      </div>
    </div>
  );
}
