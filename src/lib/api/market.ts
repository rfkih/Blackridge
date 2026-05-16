import { apiClient } from './client';
import { toNum } from './coerce';
import type { CandleData, IndicatorData, SymbolSlippageStats } from '@/types/market';
import { INTERVAL_SECONDS } from '@/lib/charts/chartTheme';

interface BackendCandle {
  time?: number;
  openTime?: number;
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BackendIndicator {
  time?: number;
  openTime?: number;
  timestamp?: number;
  ema20?: number;
  ema50?: number;
  ema200?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  kcUpper?: number;
  kcMiddle?: number;
  kcLower?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  atr?: number;
  adx?: number;
}

/** Resolve the timestamp from any of the common field names and convert to TV seconds. */
function resolveTimeSec(d: { time?: number; openTime?: number; timestamp?: number }): number {
  const raw = d.time ?? d.openTime ?? d.timestamp;
  if (raw == null || !Number.isFinite(raw)) return NaN;

  return raw > 32_503_680_000 ? Math.floor(raw / 1_000) : raw;
}

export async function fetchCandles(
  symbol: string,
  interval: string,
  count: number,
): Promise<CandleData[]> {
  const to = Date.now();
  const from = to - count * (INTERVAL_SECONDS[interval] ?? 3_600) * 1_000;

  const { data } = await apiClient.get<BackendCandle[]>('/api/v1/market', {
    params: { symbol, interval, from, to, limit: count },
  });

  return (
    data
      .map((d) => ({
        time: resolveTimeSec(d),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume ?? 0,
      }))

      .filter((c) => Number.isFinite(c.time))
      .sort((a, b) => a.time - b.time)
  );
}

export async function fetchIndicators(
  symbol: string,
  interval: string,
  count: number,
): Promise<IndicatorData[]> {
  const to = Date.now();
  const from = to - count * (INTERVAL_SECONDS[interval] ?? 3_600) * 1_000;

  const { data } = await apiClient.get<BackendIndicator[]>('/api/v1/market/indicators', {
    params: { symbol, interval, from, to },
  });

  return data
    .map((d) => ({
      time: resolveTimeSec(d),
      ema20: d.ema20 ?? null,
      ema50: d.ema50 ?? null,
      ema200: d.ema200 ?? null,
      bbUpper: d.bbUpper ?? null,
      bbMiddle: d.bbMiddle ?? null,
      bbLower: d.bbLower ?? null,
      kcUpper: d.kcUpper ?? null,
      kcMiddle: d.kcMiddle ?? null,
      kcLower: d.kcLower ?? null,
      rsi: d.rsi ?? null,
      macd: d.macd ?? null,
      macdSignal: d.macdSignal ?? null,
      macdHistogram: d.macdHistogram ?? null,
      atr: d.atr ?? null,
      adx: d.adx ?? null,
    }))
    .filter((d) => Number.isFinite(d.time))
    .sort((a, b) => a.time - b.time);
}

interface BackendSymbolSlippageStats {
  symbol?: string | null;
  sampleSize?: number | null;
  meanBps?: number | string | null;
  stddevBps?: number | string | null;
  p95AbsBps?: number | string | null;
  trustworthy?: boolean | null;
}

export async function getSymbolSlippage(symbol: string): Promise<SymbolSlippageStats | null> {
  const { data } = await apiClient.get<BackendSymbolSlippageStats | null>(
    `/api/v1/market/slippage/${encodeURIComponent(symbol)}`,
  );
  if (!data) return null;
  return {
    symbol: data.symbol ?? symbol,
    sampleSize: data.sampleSize ?? 0,
    meanBps: toNum(data.meanBps),
    stddevBps: toNum(data.stddevBps),
    p95AbsBps: toNum(data.p95AbsBps),
    trustworthy: Boolean(data.trustworthy),
  };
}
