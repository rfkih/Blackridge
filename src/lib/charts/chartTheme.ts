// Shared TradingView chart theme constants.
// TV charts are canvas-based and can't resolve CSS vars at paint time, so
// we keep a resolved hex copy here. Values mirror the Machiavelli dark
// scale in globals.css — if you change `--color-profit` or `--bg-surface`
// for the dark theme, mirror it here.

export const TV = {
  BG: '#0E1116',
  SURFACE: '#171B22',
  TEXT: '#C5CCD5',
  TEXT_MUTED: '#8C95A2',
  GRID: '#1E232C',
  BORDER: '#262D38',
  CROSSHAIR: '#8C95A2',
  LABEL_BG: '#1E232C',
  PROFIT: '#16B364',
  LOSS: '#E5484D',
  INFO: '#3B82F6',
  WARNING: '#F5A623',
  NEUTRAL: '#8C95A2',
} as const;

export const INDICATOR_COLORS = {
  ema20: '#3B82F6',
  ema50: '#F5A623',
  ema200: '#A855F7',
  bb: '#8C95A2',
  kc: '#0A7E3F',
  rsi: '#EC4899',
  macdLine: '#3B82F6',
  macdSignal: '#F5A623',
  macdUp: 'rgba(22,179,100, 0.75)',
  macdDown: 'rgba(229,72,77, 0.7)',
} as const;

export const REFETCH_INTERVALS: Record<string, number> = {
  '1m': 15_000,
  '5m': 60_000,
  '15m': 120_000,
  '1h': 300_000,
  '4h': 600_000,
  '1d': 3_600_000,
};

export const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3_600,
  '4h': 14_400,
  '1d': 86_400,
};

export const POPULAR_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
] as const;

export const BASE_PRICES: Record<string, number> = {
  BTCUSDT: 63_000,
  ETHUSDT: 3_100,
  SOLUSDT: 145,
  BNBUSDT: 580,
  XRPUSDT: 0.52,
  DOGEUSDT: 0.155,
  ADAUSDT: 0.44,
};
