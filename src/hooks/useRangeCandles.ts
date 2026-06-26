import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchCandlesRange } from '@/lib/api/market';
import { QUERY_STALE_TIMES } from '@/lib/constants';

/**
 * Candles over an explicit `[fromMs, toMs]` window for any symbol/interval — the
 * generic range fetch behind the live-trades history chart. Complements
 * `useBacktestCandles` (by run-id) and `useEmaWarmupCandles` (warmup-only),
 * neither of which fits a "candles for this arbitrary live window" need.
 *
 * Lazy: disabled until symbol, interval, and a valid (`toMs > fromMs`) window
 * are all present.
 *
 * When `refetchMs` is given the query polls on that cadence with a 0 stale time
 * (and keeps the previous data across refetches) — used by the live-trades chart so
 * the last (forming) bar rolls forward and tracks the realtime price like the market
 * viewer. Omit it for a static one-shot fetch (the default cached behaviour).
 */
export function useRangeCandles(
  symbol: string | undefined,
  interval: string | undefined,
  fromMs: number | undefined,
  toMs: number | undefined,
  enabled = true,
  refetchMs?: number,
) {
  const live = refetchMs != null && refetchMs > 0;
  return useQuery({
    queryKey: ['range-candles', symbol, interval, fromMs, toMs],
    queryFn: () =>
      fetchCandlesRange(symbol as string, interval as string, fromMs as number, toMs as number),
    enabled: enabled && !!symbol && !!interval && fromMs != null && toMs != null && toMs > fromMs,
    staleTime: live ? 0 : QUERY_STALE_TIMES.marketCandles,
    refetchInterval: live ? refetchMs : undefined,
    placeholderData: live ? keepPreviousData : undefined,
  });
}
