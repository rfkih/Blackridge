// Read-only client for /api/v1/walk-forward on the trading JVM. Backed by
// the walk_forward_run table (V12); the orchestrator (Python) writes new
// rows after every POST /walk-forward. Triggering a new run from the UI
// is intentionally out of scope — see WalkForwardController javadoc.
import { apiClient } from './client';
import type { PageEnvelope } from '@/types/api';

export type StabilityVerdict =
  | 'ROBUST'
  | 'INCONSISTENT'
  | 'INSUFFICIENT_EVIDENCE'
  | 'OVERFIT'
  | 'NO_EDGE';

export interface WalkForwardSummary {
  walkForwardId: string;
  strategyCode: string;
  instrument: string;
  intervalName: string;
  stabilityVerdict: StabilityVerdict;
  nFolds: number;
  trainMonths: number;
  testMonths: number;
  fullWindowStart: string | null;
  fullWindowEnd: string | null;
  foldPfMean: number | string | null;
  foldPfStd: number | string | null;
  foldPfMin: number | string | null;
  foldPfMax: number | string | null;
  foldPfPositivePct: number | string | null;
  foldReturnMean: number | string | null;
  foldReturnStd: number | string | null;
  foldSharpeMean: number | string | null;
  foldSharpeStd: number | string | null;
  totalTradesAcrossFolds: number | null;
  motivatingIterationId: string | null;
  createdTime: string | null;
  createdBy: string | null;
}

export type WalkForwardPage = PageEnvelope<WalkForwardSummary>;

export interface ListWalkForwardParams {
  strategyCode?: string;
  instrument?: string;
  intervalName?: string;
  verdict?: StabilityVerdict;
  page?: number;
  size?: number;
}

export async function listWalkForwardRuns(
  opts: ListWalkForwardParams = {},
): Promise<WalkForwardPage> {
  const params: Record<string, string | number> = {
    page: opts.page ?? 0,
    size: opts.size ?? 25,
  };
  if (opts.strategyCode) params.strategyCode = opts.strategyCode;
  if (opts.instrument) params.instrument = opts.instrument;
  if (opts.intervalName) params.intervalName = opts.intervalName;
  if (opts.verdict) params.verdict = opts.verdict;
  const { data } = await apiClient.get<WalkForwardPage>('/api/v1/walk-forward', {
    params,
  });
  return data;
}

