'use client';

import { useMutation } from '@tanstack/react-query';
import {
  backfillHistoricalData,
  backfillVcbIndicators,
  type VcbBackfillResult,
  type WarmupResult,
} from '@/lib/api/historical';

export function useWarmupHistorical() {
  return useMutation<WarmupResult, Error, { symbol: string; interval: string }>({
    mutationFn: ({ symbol, interval }) => backfillHistoricalData(symbol, interval),
  });
}

export function useBackfillVcbIndicators() {
  return useMutation<
    VcbBackfillResult,
    Error,
    { symbol: string; interval: string; from: string; to: string }
  >({
    mutationFn: ({ symbol, interval, from, to }) =>
      backfillVcbIndicators(symbol, interval, from, to),
  });
}
