'use client';

import { AllocationStatCards } from './AllocationStatCards';
import { AllocationPanel } from './AllocationPanel';
import { BtcStackPanel } from './BtcStackPanel';
import { DrawdownVsBuyHoldPanel } from './DrawdownVsBuyHoldPanel';
import { RebalanceHistory } from './RebalanceHistory';

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
 * The BTC-stack and drawdown-vs-buy-hold panels need a price-aligned equity
 * history the app does not expose yet, so they are passed `null` and render
 * their own honest empty states rather than a fabricated series.
 */
export function HedgingDashboard({ accountId }: HedgingDashboardProps) {
  return (
    <div className="br flex flex-col gap-4">
      <AllocationStatCards accountId={accountId} />

      <AllocationPanel accountId={accountId} />

      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}
      >
        <BtcStackPanel series={null} />
        <DrawdownVsBuyHoldPanel strategySeries={null} buyHoldSeries={null} />
      </section>

      <RebalanceHistory accountId={accountId} />
    </div>
  );
}
