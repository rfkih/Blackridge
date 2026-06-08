import type { ChartIndicators, ChartIndicatorKey } from '@/types/market';

export type IndicatorGroup = 'overlay' | 'oscillator';

export interface IndicatorDef {
  key: ChartIndicatorKey;
  label: string;
  group: IndicatorGroup;
  /** Primary colour for the toggle pill + main line. */
  color: string;
}

export const INDICATORS: readonly IndicatorDef[] = [
  { key: 'ema20', label: 'EMA 20', group: 'overlay', color: '#3B82F6' },
  { key: 'ema50', label: 'EMA 50', group: 'overlay', color: '#F5A623' },
  { key: 'ema200', label: 'EMA 200', group: 'overlay', color: '#A855F7' },
  { key: 'bollingerBands', label: 'Bollinger', group: 'overlay', color: '#8892A4' },
  { key: 'keltnerChannel', label: 'Keltner', group: 'overlay', color: '#22D3EE' },
  { key: 'rsi', label: 'RSI', group: 'oscillator', color: '#EC4899' },
  { key: 'macd', label: 'MACD', group: 'oscillator', color: '#34D399' },
  { key: 'atr', label: 'ATR', group: 'oscillator', color: '#FBBF24' },
  { key: 'adx', label: 'ADX', group: 'oscillator', color: '#60A5FA' },
] as const;

export const OVERLAY_KEYS = INDICATORS.filter((i) => i.group === 'overlay').map((i) => i.key);
export const OSCILLATOR_KEYS = INDICATORS.filter((i) => i.group === 'oscillator').map((i) => i.key);

export const DEFAULT_INDICATORS: ChartIndicators = {
  ema20: false, ema50: false, ema200: false, bollingerBands: false,
  keltnerChannel: false, rsi: false, macd: false, atr: false, adx: false,
};
