'use client';

import { Suspense, useCallback, useMemo } from 'react';
import nextDynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, LineChart, RefreshCw } from 'lucide-react';
import { SymbolPicker } from '@/components/charts/SymbolPicker';
import { IntervalTabs } from '@/components/charts/IntervalTabs';
import { OhlcvReadout } from '@/components/charts/OhlcvReadout';
import { MarketContextBar } from '@/components/market/MarketContextBar';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { fetchCandles, fetchIndicators } from '@/lib/api/market';
import { REFETCH_INTERVALS } from '@/lib/charts/chartTheme';
import { useChartIndicators } from '@/hooks/useChartIndicators';
import { IndicatorBar } from '@/components/charts/IndicatorBar';
import type { CandleData, ChartInterval, IndicatorData } from '@/types/market';
import { DEFAULT_SYMBOL } from '@/lib/symbols';

const CandlestickChart = nextDynamic(
  () => import('@/components/charts/CandlestickChart').then((m) => m.CandlestickChart),
  { ssr: false, loading: () => <Skeleton className="h-[560px] w-full" /> },
);

const CANDLE_COUNT = 500;

const INTERVAL_OPTIONS: ChartInterval[] = ['5m', '15m', '1h', '4h'];

const EMPTY_CANDLES: CandleData[] = [];
const EMPTY_FEATURES: IndicatorData[] = [];

interface MarketFilters {
  symbol: string;
  interval: ChartInterval;
}

function narrowInterval(raw: string | null): ChartInterval {
  return (INTERVAL_OPTIONS as string[]).includes(raw ?? '') ? (raw as ChartInterval) : '1h';
}

function readFilters(params: URLSearchParams): MarketFilters {
  return {
    symbol: (params.get('symbol') || DEFAULT_SYMBOL).toUpperCase(),
    interval: narrowInterval(params.get('interval')),
  };
}

export default function MarketPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[560px] w-full" />}>
      <MarketPageContent />
    </Suspense>
  );
}

function MarketPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => readFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<MarketFilters>) => {
      const next = new URLSearchParams(searchParams.toString());
      if (patch.symbol) next.set('symbol', patch.symbol.toUpperCase());
      if (patch.interval) next.set('interval', patch.interval);
      router.replace(`/market${next.toString() ? `?${next.toString()}` : ''}`);
    },
    [router, searchParams],
  );

  const { indicators, toggle, anyActive } = useChartIndicators('blackheart:market-indicators');

  const candleQuery = useQuery({
    queryKey: ['market', 'candles', filters.symbol, filters.interval],
    queryFn: () => fetchCandles(filters.symbol, filters.interval, CANDLE_COUNT),
    staleTime: 0,
    refetchInterval: REFETCH_INTERVALS[filters.interval] ?? 300_000,

    placeholderData: (prev) => prev,
    retry: false,
  });

  const indicatorQuery = useQuery({
    queryKey: ['market', 'indicators', filters.symbol, filters.interval],
    queryFn: () => fetchIndicators(filters.symbol, filters.interval, CANDLE_COUNT),
    enabled: anyActive,
    staleTime: 0,
    placeholderData: (prev) => prev,
    retry: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Market"
        title="Candlestick viewer"
        description="Browse any symbol/interval with optional EMA, Bollinger, Keltner, and RSI overlays."
      />

      {}
      <MarketContextBar />

      <section className="overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-bd-subtle px-4 py-3">
          <div className="flex items-center gap-3">
            <SymbolPicker value={filters.symbol} onChange={(s) => setFilters({ symbol: s })} />
            <IntervalTabs
              value={filters.interval}
              onChange={(iv) => setFilters({ interval: iv })}
            />
          </div>
          <LivePill active={!candleQuery.isLoading && !candleQuery.isError} />
        </div>

        <div className="border-b border-bd-subtle px-4">
          <IndicatorBar indicators={indicators} onToggle={toggle} />
        </div>

        <OhlcvHeader candles={candleQuery.data} symbol={filters.symbol} />

        <div className="relative">
          {candleQuery.isError ? (
            <ChartError onRetry={() => candleQuery.refetch()} />
          ) : candleQuery.isLoading && !candleQuery.data ? (
            <Skeleton className="h-[440px] w-full" />
          ) : (
            <ErrorBoundary label="Candlestick chart">
              <CandlestickChart
                candles={candleQuery.data ?? EMPTY_CANDLES}
                features={indicatorQuery.data ?? EMPTY_FEATURES}
                showIndicators={indicators}
              />
            </ErrorBoundary>
          )}
        </div>
      </section>
    </div>
  );
}

function OhlcvHeader({ candles, symbol }: { candles: CandleData[] | undefined; symbol: string }) {
  const last = candles && candles.length > 0 ? candles[candles.length - 1] : undefined;
  const prev = candles && candles.length > 1 ? candles[candles.length - 2] : undefined;
  if (!last) return null;
  return (
    <div className="border-b border-bd-subtle">
      <OhlcvReadout
        open={last.open}
        high={last.high}
        low={last.low}
        close={last.close}
        previousClose={prev?.close ?? null}
        volume={last.volume}
        symbol={symbol}
      />
    </div>
  );
}

function LivePill({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-wider text-text-muted">
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full"
        style={{
          background: active ? 'var(--color-profit)' : 'var(--text-muted)',
          animation: active ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      />
      Live
    </span>
  );
}

function ChartError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-[440px] flex-col items-center justify-center gap-3 text-[14px] text-text-muted">
      <AlertCircle size={20} />
      <span>Failed to load candles.</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-sm border border-bd-subtle bg-bg-base px-3 py-1.5 text-[13px] text-text-primary hover:bg-bg-hover"
      >
        <RefreshCw size={11} /> Retry
      </button>
      <LineChart size={18} className="opacity-30" />
    </div>
  );
}
