export interface StrategyRankRow {
  rank: number;
  strategyCode: string;
  symbol: string;
  intervalName: string;
  verdict: 'PASS' | 'ITERATE' | 'DISCARD' | 'FAILED';
  statisticalVerdict: 'SIGNIFICANT_EDGE' | 'INSUFFICIENT_EVIDENCE' | 'NO_EDGE' | 'NOT_TESTED' | null;
  windowDays: number;
  startTime: string;
  endTime: string;
  initialCapital: number | null;
  annualizedReturnPct: number | null;
  sharpeAnnualized: number | null;
  maxDrawdownPct: number | null;
  nTrades: number | null;
  profitFactor: number | null;
  dsr: number | null;
  psr: number | null;
  winRate: number | null;
  backtestRunId: string;
  params: Record<string, unknown>;
}

export interface StrategyRankingResponse {
  rankings: StrategyRankRow[];
  total: number;
  minWindowDays: number;
}
