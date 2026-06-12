import type { ChartIndicators, ChartIndicatorKey, IndicatorData } from '@/types/market';

export type IndicatorGroup = 'overlay' | 'oscillator';

/** One drawn line/histogram within an indicator. */
export interface IndicatorLineSpec {
  field: keyof IndicatorData;
  color: string;
  dashed?: boolean;
  histogram?: boolean;
}

export interface IndicatorDef {
  key: ChartIndicatorKey;
  label: string;
  group: IndicatorGroup;
  /** Primary colour for the toggle pill (matches the indicator's main line). */
  color: string;
  /** The series this indicator draws (single source of truth for colours). */
  series: IndicatorLineSpec[];
  /** Oscillator reference levels drawn as dashed price lines (e.g. RSI 70/30). */
  guides?: number[];
}

export const INDICATORS: readonly IndicatorDef[] = [
  {
    key: 'ema20',
    label: 'EMA 20',
    group: 'overlay',
    color: '#3B82F6',
    series: [{ field: 'ema20', color: '#3B82F6' }],
  },
  {
    key: 'ema50',
    label: 'EMA 50',
    group: 'overlay',
    color: '#F5A623',
    series: [{ field: 'ema50', color: '#F5A623' }],
  },
  {
    key: 'ema100',
    label: 'EMA 100',
    group: 'overlay',
    color: '#10B981',
    series: [{ field: 'ema100', color: '#10B981' }],
  },
  {
    key: 'ema200',
    label: 'EMA 200',
    group: 'overlay',
    color: '#A855F7',
    series: [{ field: 'ema200', color: '#A855F7' }],
  },
  {
    key: 'bollingerBands',
    label: 'Bollinger',
    group: 'overlay',
    color: '#8892A4',
    series: [
      { field: 'bbUpper', color: '#8892A4', dashed: true },
      { field: 'bbMiddle', color: '#8892A4' },
      { field: 'bbLower', color: '#8892A4', dashed: true },
    ],
  },
  {
    key: 'keltnerChannel',
    label: 'Keltner',
    group: 'overlay',
    color: '#22D3EE',
    series: [
      { field: 'kcUpper', color: '#22D3EE', dashed: true },
      { field: 'kcLower', color: '#22D3EE', dashed: true },
    ],
  },
  {
    key: 'rsi',
    label: 'RSI',
    group: 'oscillator',
    color: '#EC4899',
    series: [{ field: 'rsi', color: '#EC4899' }],
    guides: [70, 30],
  },
  {
    key: 'macd',
    label: 'MACD',
    group: 'oscillator',
    color: '#34D399',
    series: [
      { field: 'macd', color: '#34D399' },
      { field: 'macdSignal', color: '#F87171' },
      { field: 'macdHistogram', color: '#5B6472', histogram: true },
    ],
  },
  {
    key: 'atr',
    label: 'ATR',
    group: 'oscillator',
    color: '#FBBF24',
    series: [{ field: 'atr', color: '#FBBF24' }],
  },
  {
    key: 'adx',
    label: 'ADX',
    group: 'oscillator',
    color: '#60A5FA',
    series: [{ field: 'adx', color: '#60A5FA' }],
    guides: [25],
  },
] as const;

export const OVERLAY_KEYS = INDICATORS.filter((i) => i.group === 'overlay').map((i) => i.key);
export const OSCILLATOR_KEYS = INDICATORS.filter((i) => i.group === 'oscillator').map((i) => i.key);

export const DEFAULT_INDICATORS: ChartIndicators = {
  ema20: false,
  ema50: false,
  ema100: false,
  ema200: false,
  bollingerBands: false,
  keltnerChannel: false,
  rsi: false,
  macd: false,
  atr: false,
  adx: false,
};
