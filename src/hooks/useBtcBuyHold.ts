'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCandles } from '@/lib/api/market';
import { buyHoldSeries, compareToBuyHold, type BuyHoldComparison } from '@/lib/buyHold';
import {
  alignClosesToEquity,
  btcStackSeries,
  drawdownSeries,
  type BtcStackPoint,
  type DrawdownPoint,
  type EquitySample,
} from '@/lib/hedging/btcCompare';
import type { EquityPeriod } from './useEquityCurve';
import type { EquityPoint } from '@/types/market';

const BTC_SYMBOL = 'BTCUSDT';
const BTC_INTERVAL = '1d';

/** Daily candles to pull for each equity window — one per day, with a little
 *  head-room so the first equity day always has a same-day close to join. */
const PERIOD_CANDLES: Record<EquityPeriod, number> = {
  '7D': 10,
  '30D': 35,
  '90D': 100,
  ALL: 370,
};

export interface UseBtcBuyHoldResult {
  /** Strategy equity drawdown over the window, or `null` until equity loads. */
  strategyDrawdown: DrawdownPoint[] | null;
  /** BTC buy-hold drawdown over the same window, or `null` until prices load. */
  buyHoldDrawdown: DrawdownPoint[] | null;
  /** BTC-stack scoreboard (multiple of buy-hold), or `null` until both load. */
  btcStack: BtcStackPoint[] | null;
  /** One-line "vs holding BTC" verdict (upside captured / drawdown cut). */
  verdict: BuyHoldComparison | null;
  isLoading: boolean;
}

/** TV candle time is Unix seconds; equity time is ms. Normalize closes to ms. */
function toMsClose(c: { time: number; close: number }): { ts: number; close: number } {
  return { ts: c.time * 1_000, close: c.close };
}

/**
 * Joins the live strategy-equity read to a BTC price series over the same
 * window and derives the hedging dashboard's "strategy vs holding BTC" panels:
 * a strategy-vs-buy-hold drawdown overlay and a BTC-stack scoreboard. Reuses
 * the pure buy-hold math (`@/lib/buyHold`) and day-alignment
 * (`@/lib/hedging/btcCompare`) — no fabricated data: every output is `null`
 * until its real source has loaded.
 */
export function useBtcBuyHold(
  points: EquityPoint[],
  period: EquityPeriod,
): UseBtcBuyHoldResult {
  const hasEquity = points.length > 0;

  const candlesQuery = useQuery({
    queryKey: ['btc-buy-hold-candles', BTC_INTERVAL, period],
    queryFn: () => fetchCandles(BTC_SYMBOL, BTC_INTERVAL, PERIOD_CANDLES[period]),
    enabled: hasEquity,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return useMemo(() => {
    if (!hasEquity) {
      return {
        strategyDrawdown: null,
        buyHoldDrawdown: null,
        btcStack: null,
        verdict: null,
        isLoading: false,
      };
    }

    const equity: EquitySample[] = points.map((p) => ({ time: p.time, equity: p.equity }));
    const strategyDrawdown = drawdownSeries(points.map((p) => ({ time: p.time, value: p.equity })));

    const candles = candlesQuery.data;
    if (!candles || candles.length === 0) {
      return {
        strategyDrawdown,
        buyHoldDrawdown: null,
        btcStack: null,
        verdict: null,
        isLoading: candlesQuery.isLoading,
      };
    }

    const closes = candles.map(toMsClose);
    // Anchor the buy-hold leg to the strategy's starting equity so the two
    // drawdown curves are on a comparable base.
    const initialCapital = points[0]!.equity || 1;
    const aligned = alignClosesToEquity(equity, closes);
    const bhEquity = buyHoldSeries(aligned, initialCapital);
    const buyHoldDrawdown = drawdownSeries(bhEquity.map((p) => ({ time: p.ts, value: p.value })));
    const btcStack = btcStackSeries(equity, closes);

    const stratMaxDd = Math.min(0, ...strategyDrawdown.map((p) => p.drawdownPct));
    const bhMaxDd = Math.min(0, ...buyHoldDrawdown.map((p) => p.drawdownPct));
    const stratRet =
      points.length > 1 ? (points[points.length - 1]!.equity / initialCapital - 1) * 100 : 0;
    const bhRet =
      bhEquity.length > 1 ? (bhEquity[bhEquity.length - 1]!.value / initialCapital - 1) * 100 : 0;
    const verdict = compareToBuyHold(stratRet, stratMaxDd, bhRet, bhMaxDd);

    return {
      strategyDrawdown,
      buyHoldDrawdown: buyHoldDrawdown.length ? buyHoldDrawdown : null,
      btcStack: btcStack.length ? btcStack : null,
      verdict,
      isLoading: false,
    };
  }, [hasEquity, points, candlesQuery.data, candlesQuery.isLoading]);
}
