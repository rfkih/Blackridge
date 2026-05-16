
import { apiClient } from './client';
import { addOptionalParam, buildPageParams } from './queryParams';
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
  const params: Record<string, string | number | boolean> = buildPageParams(opts, 25);
  addOptionalParam(params, 'strategyCode', opts.strategyCode);
  addOptionalParam(params, 'instrument', opts.instrument);
  addOptionalParam(params, 'intervalName', opts.intervalName);
  addOptionalParam(params, 'verdict', opts.verdict);
  const { data } = await apiClient.get<WalkForwardPage>('/api/v1/walk-forward', {
    params,
  });
  return data;
}
