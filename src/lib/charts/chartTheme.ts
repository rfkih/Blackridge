
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

