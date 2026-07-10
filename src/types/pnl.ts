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
  /** Percent in [0,100] — the backend already multiplies by 100 (unlike
   *  /trades/stats, which returns a fraction). Do NOT scale again. */
  winRate: number;
  tradeCount: number;
  /** V60 — mean per-trade return rate (pnl / notional × 100). Null when this
   *  strategy has no closed trades in the window. */
  avgTradeReturnPct?: number | null;
  /** V60 — compounded return assuming 90% of equity sized per trade. */
  geometricReturnPctAtAlloc90?: number | null;
}
