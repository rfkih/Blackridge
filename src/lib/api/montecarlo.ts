import { apiClient } from './client';
import type {
  MonteCarloPathSummary,
  MonteCarloResult,
  MonteCarloSimulationMode,
  MonteCarloSubmitPayload,
} from '@/types/montecarlo';

const BASE = '/api/v1/montecarlo';

interface BackendPathSummary {
  pathIndex?: number | null;
  label?: string | null;
  finalEquity?: number | string | null;
  totalReturnPct?: number | string | null;
  maxDrawdownPct?: number | string | null;
  ruinBreached?: boolean | null;
  drawdownThresholdBreached?: boolean | null;
  equityCurve?: Array<number | string | null> | null;
}

interface BackendMonteCarloResult {
  monteCarloRunId?: string | null;
  backtestRunId?: string | null;
  simulationMode?: string | null;
  numberOfSimulations?: number | null;
  tradesUsed?: number | null;
  initialCapital?: number | string | null;
  ruinThresholdPct?: number | string | null;
  maxAcceptableDrawdownPct?: number | string | null;
  effectiveSeed?: number | null;
  sourceMeanTradePnl?: number | string | null;
  sourceMedianTradePnl?: number | string | null;
  sourceStdDevTradePnl?: number | string | null;
  sourceWinRate?: number | string | null;
  meanFinalEquity?: number | string | null;
  medianFinalEquity?: number | string | null;
  minFinalEquity?: number | string | null;
  maxFinalEquity?: number | string | null;
  finalEquityPercentiles?: Record<string, number | string | null> | null;
  meanTotalReturnPct?: number | string | null;
  medianTotalReturnPct?: number | string | null;
  minTotalReturnPct?: number | string | null;
  maxTotalReturnPct?: number | string | null;
  meanMaxDrawdownPct?: number | string | null;
  medianMaxDrawdownPct?: number | string | null;
  worstMaxDrawdownPct?: number | string | null;
  probabilityOfRuin?: number | string | null;
  probabilityOfDrawdownBreach?: number | string | null;
  probabilityOfProfit?: number | string | null;
  bestPath?: BackendPathSummary | null;
  medianPath?: BackendPathSummary | null;
  worstPath?: BackendPathSummary | null;
}

function num(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function narrowMode(v: string | null | undefined): MonteCarloSimulationMode {
  return v === 'TRADE_SEQUENCE_SHUFFLE' ? 'TRADE_SEQUENCE_SHUFFLE' : 'BOOTSTRAP_RETURNS';
}

function mapPath(p: BackendPathSummary | null | undefined): MonteCarloPathSummary | null {
  if (!p) return null;
  return {
    pathIndex: p.pathIndex ?? 0,
    label: p.label ?? '',
    finalEquity: num(p.finalEquity),
    totalReturnPct: num(p.totalReturnPct),
    maxDrawdownPct: num(p.maxDrawdownPct),
    ruinBreached: Boolean(p.ruinBreached),
    drawdownThresholdBreached: Boolean(p.drawdownThresholdBreached),
    equityCurve: (p.equityCurve ?? []).map((v) => num(v)),
  };
}

function mapPercentiles(
  raw: Record<string, number | string | null> | null | undefined,
): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    const n = num(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function mapResult(r: BackendMonteCarloResult): MonteCarloResult {
  return {
    monteCarloRunId: r.monteCarloRunId ?? '',
    backtestRunId: r.backtestRunId ?? '',
    simulationMode: narrowMode(r.simulationMode),
    numberOfSimulations: r.numberOfSimulations ?? 0,
    tradesUsed: r.tradesUsed ?? 0,
    initialCapital: num(r.initialCapital),
    ruinThresholdPct: num(r.ruinThresholdPct),
    maxAcceptableDrawdownPct: num(r.maxAcceptableDrawdownPct),
    effectiveSeed: r.effectiveSeed ?? 0,
    sourceMeanTradePnl: num(r.sourceMeanTradePnl),
    sourceMedianTradePnl: num(r.sourceMedianTradePnl),
    sourceStdDevTradePnl: num(r.sourceStdDevTradePnl),
    sourceWinRate: num(r.sourceWinRate),
    meanFinalEquity: num(r.meanFinalEquity),
    medianFinalEquity: num(r.medianFinalEquity),
    minFinalEquity: num(r.minFinalEquity),
    maxFinalEquity: num(r.maxFinalEquity),
    finalEquityPercentiles: mapPercentiles(r.finalEquityPercentiles),
    meanTotalReturnPct: num(r.meanTotalReturnPct),
    medianTotalReturnPct: num(r.medianTotalReturnPct),
    minTotalReturnPct: num(r.minTotalReturnPct),
    maxTotalReturnPct: num(r.maxTotalReturnPct),
    meanMaxDrawdownPct: num(r.meanMaxDrawdownPct),
    medianMaxDrawdownPct: num(r.medianMaxDrawdownPct),
    worstMaxDrawdownPct: num(r.worstMaxDrawdownPct),
    probabilityOfRuin: num(r.probabilityOfRuin),
    probabilityOfDrawdownBreach: num(r.probabilityOfDrawdownBreach),
    probabilityOfProfit: num(r.probabilityOfProfit),
    bestPath: mapPath(r.bestPath),
    medianPath: mapPath(r.medianPath),
    worstPath: mapPath(r.worstPath),
  };
}

export async function runMonteCarlo(payload: MonteCarloSubmitPayload): Promise<MonteCarloResult> {
  const { data } = await apiClient.post<BackendMonteCarloResult>(`${BASE}/run`, payload);
  return mapResult(data);
}
