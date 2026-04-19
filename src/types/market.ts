import type { Interval } from '@/lib/constants';
import type { EpochMs } from './api';

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
