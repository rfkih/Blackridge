'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Layers } from 'lucide-react';
import { useCarryPairs } from '@/hooks/useCarryPairs';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { summarizeCarryBook } from '@/lib/carry/summary';

/**
 * Dashboard summary of the LIVE (real-capital) carry book, scoped to the active account when one is
 * selected. The carry book runs on its own dual-leg execution path — disjoint from the directional
 * trades/positions panels — so it gets its own card: funding (the edge) up front, then net P&L,
 * notional, and the hedge residual (net Δ). Renders nothing when there is no live carry pair, so a
 * dashboard with no carry book is byte-for-byte unchanged.
 */
export function CarryBookSummaryCard({ accountId }: { accountId?: string }) {
  const { data } = useCarryPairs();
  const formatCurrency = useCurrencyFormatter();

  const realPairs = useMemo(() => {
    const pairs = (data ?? []).filter((p) => !p.simulated);
    return accountId ? pairs.filter((p) => p.accountId === accountId) : pairs;
  }, [data, accountId]);

  const s = useMemo(() => summarizeCarryBook(realPairs), [realPairs]);

  if (s.openCount === 0) return null;

  const driftTone: Tone =
    s.notional > 0 && Math.abs(s.netDeltaUsd) > s.notional * 0.02 ? 'warning' : 'neutral';

  return (
    <Link
      href="/trades?tab=carry"
      className="br-card transition-all"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        <span
          aria-hidden="true"
          className="grid place-items-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'var(--brand-50)',
            color: 'var(--brand-700)',
            flexShrink: 0,
          }}
        >
          <Layers size={20} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="mm-kicker">CARRY BOOK</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <span
              className="num"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 28,
                letterSpacing: '-0.02em',
                color: s.funding >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
              }}
            >
              {formatCurrency(s.funding, { withSign: true })}
            </span>
            <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              funding earned · {s.openCount} open pair{s.openCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
        <CarryMini
          label="Net P&L"
          value={formatCurrency(s.total, { withSign: true })}
          tone={s.total >= 0 ? 'profit' : 'loss'}
        />
        <CarryMini label="Notional" value={formatCurrency(s.notional)} />
        <CarryMini
          label="Net Δ"
          value={formatCurrency(s.netDeltaUsd, { withSign: true })}
          tone={driftTone}
        />
        <span
          className="inline-flex items-center gap-1 text-[14px] font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          View <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}

type Tone = 'profit' | 'loss' | 'warning' | 'neutral';

function CarryMini({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  const color =
    tone === 'profit'
      ? 'var(--color-profit)'
      : tone === 'loss'
        ? 'var(--color-loss)'
        : tone === 'warning'
          ? 'var(--color-warning)'
          : 'var(--text-primary)';
  return (
    <div>
      <div
        className="text-[12px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div className="num mt-0.5 font-mono tabular-nums" style={{ fontSize: 16, color }}>
        {value}
      </div>
    </div>
  );
}
