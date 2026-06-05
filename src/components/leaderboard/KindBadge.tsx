import { isHedging } from '@/lib/strategyKind';

/**
 * Small pill badge indicating the strategy kind (HEDGING or TRADING).
 * Only renders a visible badge for HEDGING — TRADING strategies get no extra
 * visual noise since that is the default.
 */
export function KindBadge({
  strategyKind,
}: {
  strategyKind?: string | null;
}) {
  if (!isHedging(strategyKind)) return null;

  return (
    <span
      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
      style={{ color: 'var(--color-btc)', backgroundColor: 'var(--tint-btc)' }}
      title="Hedging strategy — spot BTC/USDT allocation tilt. Ranked by Calmar (return ÷ max drawdown)."
    >
      Hedging
    </span>
  );
}
