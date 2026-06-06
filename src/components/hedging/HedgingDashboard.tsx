'use client';

import { AllocationStatCards } from './AllocationStatCards';
import { EarnToggleCard } from './EarnToggleCard';
import { AllocationPanel } from './AllocationPanel';
import { BtcStackPanel } from './BtcStackPanel';
import { DrawdownVsBuyHoldPanel } from './DrawdownVsBuyHoldPanel';
import { RebalanceHistory } from './RebalanceHistory';
import { useEquityCurve } from '@/hooks/useEquityCurve';
import { useBtcBuyHold } from '@/hooks/useBtcBuyHold';

interface HedgingDashboardProps {
  /** The scoped account id of the active HEDGING account. */
  accountId: string;
}

/**
 * Dashboard surface for a HEDGING account — composes the hedging widget set
 * (allocation stats + band, BTC-stack vs buy-hold, drawdown overlay, rebalance
 * log) for the active account. Mirrors the trading dashboard's grid/spacing
 * idiom (`gap-4` column with a two-up `minmax(0,1fr)` row for the side-by-side
 * charts).
 *
 * The BTC-stack and drawdown-vs-buy-hold panels are fed real data: the live
 * strategy equity from `useEquityCurve` joined to a BTC price series over the
 * same window via `useBtcBuyHold` (which reuses the pure `@/lib/buyHold` math).
 * When the BTC price read hasn't loaded, the panels render their own honest
 * empty state — never a fabricated series.
 */
export function HedgingDashboard({ accountId }: HedgingDashboardProps) {
  const { points, period } = useEquityCurve();
  const { strategyDrawdown, buyHoldDrawdown, btcStack, verdict } = useBtcBuyHold(points, period);

  return (
    <div className="br flex flex-col gap-4">
      <AllocationStatCards accountId={accountId} />

      <EarnToggleCard />

      <AllocationPanel accountId={accountId} />

      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}
      >
        <BtcStackPanel series={btcStack} />
        <DrawdownVsBuyHoldPanel
          strategySeries={strategyDrawdown}
          buyHoldSeries={buyHoldDrawdown}
          verdict={verdict}
        />
      </section>

      <RebalanceHistory accountId={accountId} />
    </div>
  );
}
