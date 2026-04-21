'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCandles, fetchIndicators } from '@/lib/api/market';
import { generateMockCandles, generateMockIndicators } from '@/lib/charts/mockData';
import { REFETCH_INTERVALS } from '@/lib/charts/chartTheme';
import type { CandleData, IndicatorData } from '@/types/market';

// Stable sentinels — keep returning the same reference when a query is
// pending so downstream useMemos don't churn on identity changes.
const EMPTY_CANDLES: CandleData[] = [];
const EMPTY_INDICATORS: IndicatorData[] = [];

// ─── localStorage helper ──────────────────────────────────────────────────────

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage disabled or quota exceeded — fine to swallow.
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChartInterval = '5m' | '15m' | '1h' | '4h';

export interface ActiveIndicators {
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  bb: boolean;
  kc: boolean;
  vol: boolean;
  rsi: boolean;
  macd: boolean;
}

const DEFAULT_INDICATORS: ActiveIndicators = {
  ema20: true,
  ema50: true,
  ema200: false,
  bb: false,
  kc: false,
  vol: true,
  rsi: false,
  macd: false,
};

const CANDLE_COUNT = 500;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarketChart() {
  const [symbol, setSymbolState] = useState<string>(() =>
    readLocal('blackheart:chart-symbol', 'BTCUSDT'),
  );
  const [interval, setIntervalState] = useState<ChartInterval>(() =>
    readLocal('blackheart:chart-interval', '1h'),
  );
  const [indicators, setIndicatorsState] = useState<ActiveIndicators>(() =>
    readLocal('blackheart:chart-indicators', DEFAULT_INDICATORS),
  );

  const setSymbol = useCallback((s: string) => {
    writeLocal('blackheart:chart-symbol', s);
    setSymbolState(s);
  }, []);

  const setInterval = useCallback((iv: ChartInterval) => {
    writeLocal('blackheart:chart-interval', iv);
    setIntervalState(iv);
  }, []);

  const toggleIndicator = useCallback((key: keyof ActiveIndicators) => {
    setIndicatorsState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeLocal('blackheart:chart-indicators', next);
      return next;
    });
  }, []);

  const needsIndicatorData = Object.entries(indicators)
    .filter(([k]) => k !== 'vol')
    .some(([, v]) => v);

  // Stable mock data — only regenerated when symbol or interval changes,
  // not on every render. Math.random() is safe here because this hook
  // is only called inside dynamic({ ssr: false }) components.
  const mockCandles = useMemo(
    () => generateMockCandles(symbol, interval, CANDLE_COUNT),
    [symbol, interval],
  );

  const candleQuery = useQuery({
    queryKey: ['market-candles', symbol, interval],
    queryFn: () => fetchCandles(symbol, interval, CANDLE_COUNT),
    staleTime: 0,
    refetchInterval: REFETCH_INTERVALS[interval] ?? 300_000,
    // Keep showing the previous symbol/interval's data while the new one
    // loads — eliminates the empty-skeleton flash when toggling intervals.
    // First-mount has no previous data, so fall back to the mock series.
    placeholderData: (previousData) => previousData ?? mockCandles,
    retry: false,
  });

  const mockIndicators = useMemo(
    () => generateMockIndicators(candleQuery.data ?? mockCandles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol, interval],
  );

  const indicatorQuery = useQuery({
    queryKey: ['market-indicators', symbol, interval],
    queryFn: () => fetchIndicators(symbol, interval, CANDLE_COUNT),
    staleTime: 0,
    enabled: needsIndicatorData,
    placeholderData: (previousData) => previousData ?? mockIndicators,
    retry: false,
  });

  return {
    symbol,
    setSymbol,
    interval,
    setInterval,
    indicators,
    toggleIndicator,
    candles: candleQuery.data ?? EMPTY_CANDLES,
    indicatorData: indicatorQuery.data ?? EMPTY_INDICATORS,
    isLoadingCandles: candleQuery.isFetching && !candleQuery.data,
    isError: candleQuery.isError,
    refetch: candleQuery.refetch,
  };
}
