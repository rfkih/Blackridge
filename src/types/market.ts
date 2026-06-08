import type { Interval } from '@/lib/constants';
import type { EpochMs } from './api';

/** TV-ready candle (time in Unix seconds). */
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Indicator values aligned to each candle (time in Unix seconds). */
export interface IndicatorData {
  time: number;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  kcUpper: number | null;
  kcMiddle: number | null;
  kcLower: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  atr: number | null;
  adx: number | null;
}

/** Account equity time-series point. */
export interface EquityPoint {
  time: EpochMs;
  equity: number;
  drawdown: number;
}

export interface FeatureStore {
  symbol: string;
  interval: Interval | string;
  ts: EpochMs;
  emaFast: number | null;
  emaSlow: number | null;
  rsi: number | null;
  adx: number | null;
  atr: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  kcUpper: number | null;
  kcMiddle: number | null;
  kcLower: number | null;
}

/**
 * Phase 3.8 — calibrated slippage stats for a symbol, fit from the user's
 * own intended-vs-actual fills. Returned by `GET /api/v1/market/slippage/:symbol`,
 * null when the symbol has no closed trades with intent recorded.
 */
export interface SymbolSlippageStats {
  symbol: string;
  sampleSize: number;
  meanBps: number;
  stddevBps: number;
  p95AbsBps: number;
  trustworthy: boolean;
}

/** Chart interval picker values for the market page. */
export type ChartInterval = '5m' | '15m' | '1h' | '4h';

/** Active-state flags for every supported chart indicator. */
export interface ChartIndicators {
  ema20: boolean;
  ema50: boolean;
  ema200: boolean;
  bollingerBands: boolean;
  keltnerChannel: boolean;
  rsi: boolean;
  macd: boolean;
  atr: boolean;
  adx: boolean;
}

export type ChartIndicatorKey = keyof ChartIndicators;
