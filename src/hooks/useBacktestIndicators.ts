import { useQuery } from '@tanstack/react-query';
import { fetchIndicatorsRange } from '@/lib/api/market';

/**
 * Indicator series for a backtest's exact window. Lazy: only fetches when at
 * least one indicator is active (`enabled`). Times are TV seconds.
 */
export function useBacktestIndicators(
  symbol: string | undefined,
  interval: string | undefined,
  fromMs: number | undefined,
  toMs: number | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['backtest', 'indicators', symbol, interval, fromMs, toMs],
    queryFn: () => fetchIndicatorsRange(symbol as string, interval as string, fromMs as number, toMs as number),
    enabled: enabled && !!symbol && !!interval && fromMs != null && toMs != null,
    staleTime: 5 * 60_000,
  });
}
