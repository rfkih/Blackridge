'use client';

import { Bitcoin, Wallet, TrendingDown } from 'lucide-react';
import { useAllocation } from '@/hooks/useAllocation';
import { useEquityCurve } from '@/hooks/useEquityCurve';

interface AllocationStatCardsProps {
  accountId: string | undefined;
}

interface StatProps {
  testId: string;
  label: string;
  value: string;
  tooltip?: string;
  tone?: 'neutral' | 'profit' | 'loss';
  icon: React.ReactNode;
}

function Stat({ testId, label, value, tooltip, tone = 'neutral', icon }: StatProps) {
  const valueColor =
    tone === 'profit' ? 'var(--mm-mint)' : tone === 'loss' ? 'var(--mm-dn)' : 'var(--mm-ink-0)';
  return (
    <div
      data-testid={`stat-${testId}`}
      className="mm-card"
      style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          title={tooltip}
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--mm-ink-2)',
          }}
        >
          {label}
        </div>
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: 'var(--mm-surface-3)',
            color: 'var(--mm-ink-1)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </span>
      </div>
      <div
        className="mm-display"
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          marginTop: 4,
          color: valueColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Header stat cards for a HEDGING account. BTC weight and cash weight come
 * from the live balance read (`useAllocation`). Max drawdown comes from the
 * equity series when present, else a "—" with a tooltip. `btcStack` and
 * `sharpe` need a price-aligned equity history the app does not expose yet,
 * so they are intentionally omitted rather than faked.
 */
export function AllocationStatCards({ accountId }: AllocationStatCardsProps) {
  const { btcWeightPct, cashWeightPct } = useAllocation(accountId);
  const equity = useEquityCurve();
  const maxDrawdown = equity.stats?.maxDrawdown ?? null;

  return (
    <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      <Stat
        testId="btcWeight"
        label="BTC weight"
        value={`${btcWeightPct.toFixed(2)}%`}
        icon={<Bitcoin size={16} strokeWidth={2} />}
      />
      <Stat
        testId="cashWeight"
        label="Cash weight"
        value={`${cashWeightPct.toFixed(2)}%`}
        icon={<Wallet size={16} strokeWidth={2} />}
      />
      <Stat
        testId="maxDrawdown"
        label="Max drawdown"
        value={maxDrawdown != null ? `${maxDrawdown.toFixed(2)}%` : '—'}
        tooltip={maxDrawdown == null ? 'needs equity history' : undefined}
        tone={maxDrawdown != null && maxDrawdown < 0 ? 'loss' : 'neutral'}
        icon={<TrendingDown size={16} strokeWidth={2} />}
      />
    </section>
  );
}
