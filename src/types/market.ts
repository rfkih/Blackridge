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
  time: EpochMs; // epoch ms
  equity: number; // USDT
  drawdown: number; // percentage (negative, e.g. -5.2 means -5.2%)
}

export interface MarketData {
  symbol: string;
  interval: Interval | string;
  openTime: EpochMs;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: EpochMs;
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
