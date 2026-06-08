import { useQuery } from '@tanstack/react-query';
import { fetchCandlesRange } from '@/lib/api/market';
import { INTERVAL_SECONDS } from '@/lib/charts/chartTheme';

const WARMUP_BARS = 150; // > 100 so a 100-period EMA is fully seeded by the window start

/** Candles for ~150 bars BEFORE windowStartMs, used to seed a long EMA so it
 *  has a value from the first in-window bar. Lazy: only when enabled. */
export function useEmaWarmupCandles(
  symbol: string | undefined,
  interval: string | undefined,
  windowStartMs: number | undefined,
  enabled: boolean,
) {
  const stepMs = (INTERVAL_SECONDS[interval ?? ''] ?? 86_400) * 1_000;
  const fromMs = windowStartMs != null ? windowStartMs - WARMUP_BARS * stepMs : undefined;
  return useQuery({
    queryKey: ['ema-warmup', symbol, interval, windowStartMs],
    queryFn: () => fetchCandlesRange(symbol as string, interval as string, fromMs as number, windowStartMs as number),
    enabled: enabled && !!symbol && !!interval && windowStartMs != null,
    staleTime: 5 * 60_000,
  });
}
