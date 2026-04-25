import { apiClient } from './client';
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

export async function getResearchLog(
  strategyCode?: string,
  limit = 50,
): Promise<ResearchLogRow[]> {
  const { data } = await apiClient.get<ResearchLogRow[]>(`${BASE}/log`, {
    params: { strategyCode, limit },
  });
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
  const { data } = await apiClient.get<SweepState[]>(`${BASE}/sweeps`);
  return data;
}
