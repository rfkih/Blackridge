// Phase 1 decoupling: research endpoints live on the research JVM (8081).
// Aliasing to `apiClient` keeps every call-site below unchanged.
import { researchClient as apiClient } from './client';
import type { Page } from '@/types/api';
import type {
  AnalysisReport,
  ResearchLogRow,
  SweepSpec,
  SweepState,
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
  const { data } = await apiClient.get<AnalysisReport>(
    `${BASE}/backtest/${runId}/analysis`,
    { params: { recompute } },
  );
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
 * Legacy shape — backend now always returns a Page envelope, so we unwrap
 * `content` here to keep the existing standalone /research/log page working.
 * New callers should use {@link searchResearchLog} for proper page metadata.
 */
export async function getResearchLog(
  strategyCode?: string,
  limit = 50,
): Promise<ResearchLogRow[]> {
  const { data } = await apiClient.get<Page<ResearchLogRow>>(`${BASE}/log`, {
    params: { strategyCode, size: limit },
  });
  return data.content ?? [];
}

export interface ResearchLogQuery {
  strategyCode?: string;
  asset?: string;
  interval?: string;
  page?: number;
  size?: number;
}

/**
 * Filterable + paginated counterpart of {@link getResearchLog}. Backend caps
 * `size` at 200; default 25 matches the dashboard panel size. Empty/blank
 * filter values are dropped before send so the backend treats them as
 * "no filter on that column".
 */
export async function searchResearchLog(
  q: ResearchLogQuery = {},
): Promise<Page<ResearchLogRow>> {
  const params: Record<string, string | number> = {
    page: q.page ?? 0,
    size: q.size ?? 25,
  };
  if (q.strategyCode && q.strategyCode.trim()) params.strategyCode = q.strategyCode.trim();
  if (q.asset && q.asset.trim()) params.asset = q.asset.trim();
  if (q.interval && q.interval.trim()) params.interval = q.interval.trim();
  const { data } = await apiClient.get<Page<ResearchLogRow>>(`${BASE}/log`, { params });
  return data;
}

// ── Sweep driver ────────────────────────────────────────────────────────────

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

export interface SweepsQuery {
  /** CSV like "RUNNING,PENDING" matching the controller's `?status=` parser. */
  status?: string;
  /** Spring sort string — "createdAt,desc" / "status,asc" / "finishedCombos,desc"
   *  / "totalCombos,desc". Backend whitelists the field; unknown falls back to
   *  createdAt,desc so a malformed param can't drop the page. */
  sort?: string;
  page?: number;
  size?: number;
}

/**
 * Filterable + paginated counterpart of {@link listSweeps}. Backend caps `size`
 * at 100; default 25 matches the dashboard panel size. Empty/blank `status`
 * means "all statuses".
 */
export async function searchSweeps(q: SweepsQuery = {}): Promise<Page<SweepState>> {
  const params: Record<string, string | number> = {
    page: q.page ?? 0,
    size: q.size ?? 25,
  };
  if (q.status && q.status.trim()) params.status = q.status.trim();
  if (q.sort && q.sort.trim()) params.sort = q.sort.trim();
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
