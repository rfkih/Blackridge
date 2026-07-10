import { researchClient as apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';
import { addOptionalParam, buildPageParams } from './queryParams';
import type { Page } from '@/types/api';
import type {
  AnalysisReport,
  ResearchLogQuery,
  ResearchLogRow,
  SweepSpec,
  SweepState,
  SweepsQuery,
  TprParams,
} from '@/types/research';

const BASE = '/api/v1/research';

/**
 * Fetch the diagnostic report for a backtest run. When {@code recompute} is
 * true the backend re-runs the analysis against current bucket definitions
 * — useful when we've evolved the analysis logic since the run finished.
 */
export async function getBacktestAnalysis(
  runId: string,
  recompute = false,
): Promise<AnalysisReport> {
  const { data } = await apiClient.get<AnalysisReport>(`${BASE}/backtest/${runId}/analysis`, {
    params: { recompute },
  });
  return data;
}

/**
 * Live TPR params loader. Kept after the standalone TPR-params editor was
 * removed because {@code useStrategyDefaults} still calls this to seed the
 * sweep wizard's param picker — TPR is a singleton so its "current" params
 * double as its baseline.
 */
export async function getTprParams(): Promise<TprParams> {
  const { data } = await apiClient.get<TprParams>(`${BASE}/tpr/params`);
  return data;
}

/** Wire shape of a research-log row. Jackson can emit BigDecimal metrics as
 *  number-or-string, and every metric is null for zero-trade runs — coerce at
 *  the boundary so render code never calls `.toFixed` on a string/null. */
type BackendResearchLogRow = Omit<
  ResearchLogRow,
  | 'tradeCount'
  | 'winRate'
  | 'profitFactor'
  | 'avgR'
  | 'netPnl'
  | 'maxDrawdown'
  | 'maxConsecutiveLosses'
> & {
  tradeCount: number | string | null;
  winRate: number | string | null;
  profitFactor: number | string | null;
  avgR: number | string | null;
  netPnl: number | string | null;
  maxDrawdown: number | string | null;
  maxConsecutiveLosses: number | string | null;
};

function mapResearchLogRow(r: BackendResearchLogRow): ResearchLogRow {
  return {
    ...r,
    tradeCount: toNum(r.tradeCount, 0),
    winRate: toNumOrNull(r.winRate),
    profitFactor: toNumOrNull(r.profitFactor),
    avgR: toNumOrNull(r.avgR),
    netPnl: toNumOrNull(r.netPnl),
    maxDrawdown: toNumOrNull(r.maxDrawdown),
    maxConsecutiveLosses: toNum(r.maxConsecutiveLosses, 0),
  };
}

/**
 * Filterable + paginated research log. Backend caps `size` at 200; default 25
 * matches the dashboard panel size. Empty/blank filter values are dropped
 * before send so the backend treats them as "no filter on that column".
 */
export async function searchResearchLog(q: ResearchLogQuery = {}): Promise<Page<ResearchLogRow>> {
  const params: Record<string, string | number | boolean> = buildPageParams(q, 25);
  addOptionalParam(params, 'strategyCode', q.strategyCode);
  addOptionalParam(params, 'asset', q.asset);
  addOptionalParam(params, 'interval', q.interval);
  addOptionalParam(params, 'search', q.search);
  addOptionalParam(params, 'sort', q.sort);
  const { data } = await apiClient.get<Page<BackendResearchLogRow>>(`${BASE}/log`, { params });
  return { ...data, content: (data.content ?? []).map(mapResearchLogRow) };
}

/** Start a sweep. `idempotencyKey` dedupes retries/double-submits server-side
 *  (ignored by builds that don't read it — same-origin via the Next proxy). */
export async function createSweep(spec: SweepSpec, idempotencyKey?: string): Promise<SweepState> {
  const { data } = await apiClient.post<SweepState>(`${BASE}/sweeps`, spec, {
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
  return data;
}

export async function getSweep(sweepId: string): Promise<SweepState> {
  const { data } = await apiClient.get<SweepState>(`${BASE}/sweeps/${sweepId}`);
  return data;
}

export async function listSweeps(): Promise<SweepState[]> {
  const { data } = await apiClient.get<Page<SweepState>>(`${BASE}/sweeps`);
  return data.content ?? [];
}

/**
 * Filterable + paginated counterpart of {@link listSweeps}. Backend caps `size`
 * at 100; default 25 matches the dashboard panel size. Empty/blank `status`
 * means "all statuses".
 */
export async function searchSweeps(q: SweepsQuery = {}): Promise<Page<SweepState>> {
  const params: Record<string, string | number | boolean> = buildPageParams(q, 25);
  addOptionalParam(params, 'status', q.status);
  addOptionalParam(params, 'sort', q.sort);
  const { data } = await apiClient.get<Page<SweepState>>(`${BASE}/sweeps`, { params });
  return data;
}

/**
 * One-shot unbiased evaluation. The server enforces single-shot via a
 * unique partial DB index; a second call after the sweep already has a
 * holdout run returns 4xx with a clear error.
 */
export async function evaluateHoldout(
  sweepId: string,
  paramSet: Record<string, number | string | boolean>,
): Promise<{ backtestRunId: string; sweepId: string }> {
  const { data } = await apiClient.post<{ backtestRunId: string; sweepId: string }>(
    `${BASE}/sweeps/${sweepId}/evaluate-holdout`,
    { paramSet },
  );
  return data;
}
