import { researchClient as apiClient } from './client';
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
  const { data } = await apiClient.get<Page<ResearchLogRow>>(`${BASE}/log`, { params });
  return data;
}

export async function createSweep(spec: SweepSpec): Promise<SweepState> {
  const { data } = await apiClient.post<SweepState>(`${BASE}/sweeps`, spec);
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
