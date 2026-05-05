'use client';

import { useMutation } from '@tanstack/react-query';
import {
  backfillHistoricalData,
  backfillIndicators,
  type IndicatorBackfillRequest,
  type IndicatorBackfillResult,
  type WarmupResult,
} from '@/lib/api/historical';

export function useWarmupHistorical() {
  return useMutation<WarmupResult, Error, { symbol: string; interval: string }>({
    mutationFn: ({ symbol, interval }) => backfillHistoricalData(symbol, interval),
  });
}

/**
 * General indicator-backfill mutation. Recomputes ALL feature-store columns
 * across a date range — works for every strategy. The optional
 * {@code recompute} flag toggles delete-then-insert vs the default
 * fill-missing-only mode.
 */
export function useBackfillIndicators() {
  return useMutation<IndicatorBackfillResult, Error, IndicatorBackfillRequest>({
    mutationFn: backfillIndicators,
  });
}
