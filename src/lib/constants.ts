export const API_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8080';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL?.trim() || 'ws://localhost:8080/ws';

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type Interval = (typeof INTERVALS)[number];

export const STRATEGY_CODES = [
  'LSR',
  'LSR_V2',
  'VCB',
  'TREND_PULLBACK_SINGLE_EXIT',
  'RAHT_V1',
  'TSMOM_V1',
] as const;
export type StrategyCode = (typeof STRATEGY_CODES)[number];

export const QUERY_STALE_TIMES = {
  openPositions: 0,
  closedTrades: 30_000,
  backtestResults: Number.POSITIVE_INFINITY,
  strategyParams: 60_000,
  pnlSummary: 30_000,
  portfolio: 60_000,
  marketCandles: 60_000,
} as const;
