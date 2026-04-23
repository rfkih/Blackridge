// Shared TradingView chart theme constants.
// TV/Recharts need raw hex values (canvas-based, can't resolve CSS vars at paint
// time). Keep these in lockstep with the MONO-MINT tokens in globals.css — if
// you edit `--color-profit` or `--bg-surface`, mirror the change here.

export const TV = {
  BG: '#0F1111',
  SURFACE: '#191E20',
  TEXT: '#C5C8C7',
  TEXT_MUTED: '#898D8C',
  GRID: '#222729',
  BORDER: '#2C3134',
  CROSSHAIR: '#898D8C',
  LABEL_BG: '#222729',
  PROFIT: '#1FC896',
  LOSS: '#FF7A7A',
  INFO: '#5A9EFF',
  WARNING: '#F3C95E',
  NEUTRAL: '#898D8C',
} as const;

export const INDICATOR_COLORS = {
  ema20: '#5A9EFF',
  ema50: '#F3C95E',
  ema200: '#A855F7',
  bb: '#898D8C',
  kc: '#17A57A',
  rsi: '#EC4899',
  macdLine: '#5A9EFF',
  macdSignal: '#F3C95E',
  macdUp: 'rgba(31, 200, 150, 0.7)',
  macdDown: 'rgba(255, 122, 122, 0.7)',
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
