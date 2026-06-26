'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchCandles } from '@/lib/api/market';

/** Brisk poll cadence for the realtime current-price probe (tiny count=2 payload). */
const LIVE_PRICE_POLL_MS = 15_000;

/**
 * Realtime "current price" for ANY symbol/interval, independent of whether an open
 * position exists. Polls the market endpoint for the latest (forming) candle and
 * returns its close.
 *
 * The open-position WS PnL feed (`useLiveSymbolPrice`) only emits a price for live
 * trades; when nothing is open on the symbol (e.g. a dormant book) it is silent.
 * This probe is the position-independent fallback that keeps the trades chart's last
 * bar synced to the live price — and identical across every interval, since each
 * interval's forming-bar close is the same spot price.
 */
export function useLivePriceProbe(
  symbol: string | undefined,
  interval: string | undefined,
  enabled = true,
): number | null {
  const { data } = useQuery({
    queryKey: ['live-price-probe', symbol, interval],
    queryFn: () => fetchCandles(symbol as string, interval as string, 2),
    enabled: enabled && !!symbol && !!interval,
    staleTime: 0,
    refetchInterval: LIVE_PRICE_POLL_MS,
    placeholderData: keepPreviousData,
    select: (candles) => {
      const last = candles.length > 0 ? candles[candles.length - 1] : null;
      return last && Number.isFinite(last.close) && last.close > 0 ? last.close : null;
    },
  });
  return data ?? null;
}
