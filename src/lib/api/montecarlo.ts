import { researchClient as apiClient } from './client';
import { toNum } from './coerce';
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

function narrowMode(v: string | null | undefined): MonteCarloSimulationMode {
  return v === 'TRADE_SEQUENCE_SHUFFLE' ? 'TRADE_SEQUENCE_SHUFFLE' : 'BOOTSTRAP_RETURNS';
}

function mapPath(p: BackendPathSummary | null | undefined): MonteCarloPathSummary | null {
  if (!p) return null;
  return {
    pathIndex: p.pathIndex ?? 0,
    label: p.label ?? '',
    finalEquity: toNum(p.finalEquity),
    totalReturnPct: toNum(p.totalReturnPct),
    maxDrawdownPct: toNum(p.maxDrawdownPct),
    ruinBreached: Boolean(p.ruinBreached),
    drawdownThresholdBreached: Boolean(p.drawdownThresholdBreached),
    equityCurve: (p.equityCurve ?? []).map((v) => toNum(v)),
  };
}

function mapPercentiles(
  raw: Record<string, number | string | null> | null | undefined,
): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) continue;
    const n = toNum(v);
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
    initialCapital: toNum(r.initialCapital),
    ruinThresholdPct: toNum(r.ruinThresholdPct),
    maxAcceptableDrawdownPct: toNum(r.maxAcceptableDrawdownPct),
    effectiveSeed: r.effectiveSeed ?? 0,
    sourceMeanTradePnl: toNum(r.sourceMeanTradePnl),
    sourceMedianTradePnl: toNum(r.sourceMedianTradePnl),
    sourceStdDevTradePnl: toNum(r.sourceStdDevTradePnl),
    sourceWinRate: toNum(r.sourceWinRate),
    meanFinalEquity: toNum(r.meanFinalEquity),
    medianFinalEquity: toNum(r.medianFinalEquity),
    minFinalEquity: toNum(r.minFinalEquity),
    maxFinalEquity: toNum(r.maxFinalEquity),
    finalEquityPercentiles: mapPercentiles(r.finalEquityPercentiles),
    meanTotalReturnPct: toNum(r.meanTotalReturnPct),
    medianTotalReturnPct: toNum(r.medianTotalReturnPct),
    minTotalReturnPct: toNum(r.minTotalReturnPct),
    maxTotalReturnPct: toNum(r.maxTotalReturnPct),
    meanMaxDrawdownPct: toNum(r.meanMaxDrawdownPct),
    medianMaxDrawdownPct: toNum(r.medianMaxDrawdownPct),
    worstMaxDrawdownPct: toNum(r.worstMaxDrawdownPct),
    probabilityOfRuin: toNum(r.probabilityOfRuin),
    probabilityOfDrawdownBreach: toNum(r.probabilityOfDrawdownBreach),
    probabilityOfProfit: toNum(r.probabilityOfProfit),
    bestPath: mapPath(r.bestPath),
    medianPath: mapPath(r.medianPath),
    worstPath: mapPath(r.worstPath),
  };
}

export async function runMonteCarlo(payload: MonteCarloSubmitPayload): Promise<MonteCarloResult> {
  const { data } = await apiClient.post<BackendMonteCarloResult>(`${BASE}/run`, payload);
  return mapResult(data);
}
