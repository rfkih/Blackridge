'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { useTradesList } from '@/hooks/useTrades';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import type { Trades } from '@/types/trading';

interface ActivityEvent {
  id: string;
  kind: 'buy' | 'sell';
  strategyCode: string;
  symbol: string;
  qty: number;
  price: number;
  ts: number;
  href: string;
}

const ROW_LIMIT = 6;

/**
 * "Recent activity" feed. Mirrors the design pack's `dashboard.html` →
 * `.activity` panel — colored circular icon, "<Strategy> bought / sold
 * <qty> <SYM> at $<px>" copy, mono timestamp on the right.
 *
 * Sources from the trades list: an OPEN trade emits one entry event, a
 * CLOSED trade emits an exit event (we surface the most-recent action
 * per trade, capped at the latest 6).
 */
export function RecentActivityFeed() {
  const { scopedAccountId } = useActiveAccount();
  const { data, isLoading } = useTradesList({
    accountId: scopedAccountId,
    size: 12,
  });

  const events = useMemo<ActivityEvent[]>(() => {
    const trades: Trades[] = data?.content ?? [];
    const out: ActivityEvent[] = [];
    for (const t of trades) {
      const isClosed =
        t.status === 'CLOSED' && t.exitTime != null && t.exitAvgPrice != null;
      if (isClosed) {
        out.push({
          id: `${t.id}-exit`,
          // Closing a LONG = sell; closing a SHORT = buy (cover)
          kind: t.direction === 'LONG' ? 'sell' : 'buy',
          strategyCode: String(t.strategyCode),
          symbol: t.symbol,
          qty: t.quantity,
          price: t.exitAvgPrice as number,
          ts: t.exitTime as number,
          href: `/trades/${t.id}`,
        });
      } else {
        out.push({
          id: `${t.id}-entry`,
          kind: t.direction === 'LONG' ? 'buy' : 'sell',
          strategyCode: String(t.strategyCode),
          symbol: t.symbol,
          qty: t.quantity,
          price: t.entryPrice,
          ts: t.entryTime,
          href: `/trades/${t.id}`,
        });
      }
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, ROW_LIMIT);
  }, [data?.content]);

  return (
    <div
      className="mm-card"
      style={{
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h3
          className="mm-display"
          style={{ fontSize: 16, color: 'var(--mm-ink-0)', margin: 0 }}
        >
          Recent activity
        </h3>
        <Link
          href="/trades"
          style={{
            fontSize: 12,
            color: 'var(--mm-mint)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          View all →
        </Link>
      </div>

      {isLoading && events.length === 0 ? (
        <ActivityEmpty label="Loading recent trades…" />
      ) : events.length === 0 ? (
        <ActivityEmpty label="No trades yet — your strategies will fill this in." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((e, i) => (
            <ActivityRow key={e.id} event={e} isLast={i === events.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityEmpty({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '20px 0',
        fontSize: 13,
        color: 'var(--mm-ink-2)',
        textAlign: 'center',
      }}
    >
      {label}
    </div>
  );
}

function ActivityRow({ event, isLast }: { event: ActivityEvent; isLast: boolean }) {
  const formatCurrency = useCurrencyFormatter();
  const isBuy = event.kind === 'buy';
  const verb = isBuy ? 'bought' : 'sold';
  const Icon = isBuy ? ArrowUp : ArrowDown;
  const iconBg = isBuy ? 'var(--mm-mint-soft)' : 'var(--mm-dn-soft)';
  const iconColor = isBuy ? 'var(--mm-mint)' : 'var(--mm-dn)';
  const displaySym = event.symbol.replace(/USDT$/, '');
  const qty = formatQty(event.qty, displaySym);

  return (
    <Link
      href={event.href}
      style={{
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--mm-hair)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: iconBg,
          color: iconColor,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon size={14} strokeWidth={2.5} />
      </span>
      <span
        style={{
          fontSize: 13,
          lineHeight: 1.4,
          color: 'var(--mm-ink-0)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <strong style={{ fontWeight: 700 }}>{event.strategyCode}</strong> {verb}{' '}
        <span
          className="font-mono"
          style={{ color: 'var(--mm-ink-2)' }}
        >
          {qty} {displaySym}
        </span>{' '}
        at {formatCurrency(event.price)}
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: 11,
          color: 'var(--mm-ink-2)',
          whiteSpace: 'nowrap',
        }}
      >
        {shortAgo(event.ts)}
      </span>
    </Link>
  );
}

function formatQty(q: number, sym: string): string {
  if (!Number.isFinite(q)) return '—';
  // BTC and ETH carry more precision; smaller-cap pairs round to 2 dp.
  const dp = sym === 'BTC' ? 4 : sym === 'ETH' ? 3 : 2;
  return q.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function shortAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
