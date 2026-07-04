'use client';

import { Bitcoin, Wallet, TrendingDown, PiggyBank, Coins } from 'lucide-react';
import { useAllocation } from '@/hooks/useAllocation';
import { useEquityCurve } from '@/hooks/useEquityCurve';
import { useEarnPosition } from '@/hooks/useEarnPosition';
import { useCurrencyFormatter } from '@/hooks/useCurrency';
import { useCurrencyStore } from '@/store/currencyStore';

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
            fontSize: 13,
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
  // useAllocation returns Earn-inclusive equity (the backend folds Earn into
  // totalUsdt) with Earn added into the cash sleeve, so consume its weights
  // directly — a manual recompute here would re-add Earn and double-count it.
  const { btcWeightPct, cashWeightPct, earnUsdt } = useAllocation(accountId);
  const equity = useEquityCurve();
  const maxDrawdown = equity.stats?.maxDrawdown ?? null;

  // Keep useEarnPosition only for the on/off state of the In-Earn card; it
  // dedupes with useAllocation's call (same query key).
  const earn = useEarnPosition(accountId);
  const formatCurrency = useCurrencyFormatter();
  const displayCurrency = useCurrencyStore((s) => s.displayCurrency);
  const earnEnabled = earn.data?.enabled ?? false;
  const interestEarned = earn.data?.accruedYieldUsdt ?? 0;

  // Interest accrues in sub-cent increments, so show 4 decimals — but only in
  // USD view, where the figure is a direct USDT amount. BTC/IDR keep their
  // currency-aware precision (4dp of a $0.04 conversion would just read as 0).
  const interestFmtOpts =
    displayCurrency === 'USD'
      ? { minimumFractionDigits: 4, maximumFractionDigits: 4 }
      : undefined;

  const earnValue =
    earnUsdt > 0 ? formatCurrency(earnUsdt) : earnEnabled ? formatCurrency(0) : 'Off';
  const interestValue =
    interestEarned > 0
      ? formatCurrency(interestEarned, interestFmtOpts)
      : earnEnabled
        ? formatCurrency(0, interestFmtOpts)
        : 'Off';

  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
        tooltip={earnUsdt > 0 ? 'Includes USDT parked in Simple Earn' : undefined}
        icon={<Wallet size={16} strokeWidth={2} />}
      />
      <Stat
        testId="inEarn"
        label="In Earn (USDT)"
        value={earnValue}
        tooltip="Idle USDT parked in Binance Flexible Simple Earn, earning yield. Redeemed automatically before the strategy buys BTC."
        tone={earnUsdt > 0 ? 'profit' : 'neutral'}
        icon={<PiggyBank size={16} strokeWidth={2} />}
      />
      <Stat
        testId="interestEarned"
        label="Interest earned"
        value={interestValue}
        tooltip="Interest accrued so far on USDT parked in Binance Simple Earn. Unrealized — now added to your equity curve continuously as it accrues, not only when the cash is redeemed."
        tone={interestEarned > 0 ? 'profit' : 'neutral'}
        icon={<Coins size={16} strokeWidth={2} />}
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
