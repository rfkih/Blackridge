import type { UUID } from './api';

export type MonteCarloSimulationMode = 'TRADE_SEQUENCE_SHUFFLE' | 'BOOTSTRAP_RETURNS';

/**
 * Single simulated path — equity values are indexed by trade number.
 * equityCurve[0] is the initial capital; equityCurve[i] is equity after
 * trade i. Only the best, median, and worst paths are returned in full.
 */
export interface MonteCarloPathSummary {
  pathIndex: number;
  label: 'BEST' | 'MEDIAN' | 'WORST' | string;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  ruinBreached: boolean;
  drawdownThresholdBreached: boolean;
  equityCurve: number[];
}

export interface MonteCarloResult {
  monteCarloRunId: UUID;
  backtestRunId: UUID;
  simulationMode: MonteCarloSimulationMode;
  numberOfSimulations: number;
  tradesUsed: number;
  initialCapital: number;
  ruinThresholdPct: number;
  maxAcceptableDrawdownPct: number;
  effectiveSeed: number;

  sourceMeanTradePnl: number;
  sourceMedianTradePnl: number;
  sourceStdDevTradePnl: number;
  sourceWinRate: number;

  meanFinalEquity: number;
  medianFinalEquity: number;
  minFinalEquity: number;
  maxFinalEquity: number;

  /** Keyed by "P5","P10","P25","P50","P75","P90","P95" (+any custom levels). */
  finalEquityPercentiles: Record<string, number>;

  meanTotalReturnPct: number;
  medianTotalReturnPct: number;
  minTotalReturnPct: number;
  maxTotalReturnPct: number;

  meanMaxDrawdownPct: number;
  medianMaxDrawdownPct: number;
  worstMaxDrawdownPct: number;

  probabilityOfRuin: number;
  probabilityOfDrawdownBreach: number;
  probabilityOfProfit: number;

  bestPath: MonteCarloPathSummary | null;
  medianPath: MonteCarloPathSummary | null;
  worstPath: MonteCarloPathSummary | null;
}

export interface MonteCarloSubmitPayload {
  backtestRunId: UUID;
  initialCapital?: number;
  simulationMode: MonteCarloSimulationMode;
  numberOfSimulations: number;
  horizonTrades?: number;
  confidenceLevels?: number[];
  ruinThresholdPct?: number;
  maxAcceptableDrawdownPct?: number;
  randomSeed?: number;
}
