'use client';

import { useMemo } from 'react';
import { useTradesList } from './useTrades';
import type { Trades } from '@/types/trading';

/**
 * One rebalance event on a HEDGING account. The engines rebalance the BTC
 * weight by **close-and-reopen** (long-only), so each closed `trade_history`
 * row is one weight-change event.
 */
export interface RebalanceEvent {
  /** Trade id of the closed leg this event maps from. */
  id: string;
  /** Event time (the close time, falling back to entry time). */
  time: number;
  /** BTC weight before the rebalance, as a percentage. `null` — the app does
   *  not (yet) expose the pre/post allocation snapshot per rebalance, so we
   *  surface "not available" rather than fabricate. */
  fromWeightPct: number | null;
  /** BTC weight after the rebalance, as a percentage. `null` — see above. */
  toWeightPct: number | null;
  /** Human-readable cause (add / de-risk / the leg's exit reason). */
  reason: string;
  /** Realized USDT P&L booked when the leg closed. */
  realizedDelta: number;
}

export interface UseRebalancesResult {
  /** Rebalance events, newest-first. Always an array (never undefined). */
  data: RebalanceEvent[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Map a closed trade into the reason for its rebalance. A LONG BTC leg that
 * closed in profit/loss is a "de-risk" of the BTC weight back toward cash;
 * fall back to the leg's exit reason when present so the table is informative
 * without inventing data.
 */
function reasonFor(trade: Trades): string {
  const exitReason = trade.positions.find((p) => p.exitReason)?.exitReason;
  if (exitReason) return exitReason.replace(/_/g, ' ').toLowerCase();
  return 'de-risk';
}

function toEvent(trade: Trades): RebalanceEvent {
  return {
    id: trade.id,
    time: trade.exitTime ?? trade.entryTime,
    fromWeightPct: null,
    toWeightPct: null,
    reason: reasonFor(trade),
    realizedDelta: trade.realizedPnl,
  };
}

/**
 * Rebalance history for a HEDGING account — the close-and-reopen events from
 * `trade_history`, reusing the existing trades-list read filtered to the
 * account's CLOSED trades. Best-effort + typed: weights that the backend does
 * not expose per-event stay `null`.
 */
export function useRebalances(accountId: string | undefined): UseRebalancesResult {
  const query = useTradesList({ accountId, status: 'CLOSED' });

  const data = useMemo(() => {
    const trades = query.data?.content ?? [];
    return trades.map(toEvent).sort((a, b) => b.time - a.time);
  }, [query.data]);

  return { data, isLoading: query.isLoading, isError: query.isError };
}
