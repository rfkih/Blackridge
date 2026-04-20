// Shared TradingView chart theme constants.
// All colors reference CSS variable values (not the vars themselves, since TV is canvas-based).

export const TV = {
  BG: '#111318',
  SURFACE: '#1A1D24',
  TEXT: '#8892A4',
  TEXT_MUTED: '#4A5160',
  GRID: '#1E2230',
  BORDER: '#2A2F3A',
  CROSSHAIR: '#3D4455',
  LABEL_BG: '#22262F',
  PROFIT: '#00C896',
  LOSS: '#FF4D6A',
  INFO: '#4E9EFF',
  WARNING: '#F5A623',
  NEUTRAL: '#8892A4',
} as const;

export const INDICATOR_COLORS = {
  ema20: '#4E9EFF',
  ema50: '#F5A623',
  ema200: '#A855F7',
  bb: '#8892A4',
  kc: '#14B8A6',
  rsi: '#EC4899',
  macdLine: '#4E9EFF',
  macdSignal: '#F5A623',
  macdUp: 'rgba(0,200,150,0.7)',
  macdDown: 'rgba(255,77,106,0.7)',
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
