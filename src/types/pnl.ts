import type { ISO8601 } from './api';

/** Single day bucket in the realized-P&L series returned by /pnl/daily. */
export interface DailyPnl {
  /** ISO date string — always "YYYY-MM-DD", no time component. */
  date: ISO8601;
  realizedPnl: number;
  tradeCount: number;
}

/** Per-strategy aggregate returned by /pnl/by-strategy. */
export interface StrategyPnl {
  strategyCode: string;
  totalPnl: number;
  winRate: number;
  tradeCount: number;
}
