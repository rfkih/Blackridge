import { apiClient } from './client';

export type CrossWindowVerdict =
  | 'ROBUST_CROSS_WINDOW'
  | 'INCONSISTENT'
  | 'NO_EDGE'
  | 'INSUFFICIENT_DATA'
  | string;

export interface CrossWindowRun {
  crossWindowId: string;
  strategyCode: string;
  intervalName: string;
  instrument: string;
  windowsCatalogVersion: string;
  nWindows: number;
  nWindowsCompleted: number;
  windowPfMean: number | null;
  windowPfStd: number | null;
  windowPfMin: number | null;
  windowPfMax: number | null;
  pctWindowsNetPositive: number | null;
  windowReturnMean: number | null;
  windowReturnStd: number | null;
  totalTradesAcrossWindows: number | null;
  crossWindowVerdict: CrossWindowVerdict;
  motivatingIterationId: string | null;
  motivatingWalkForwardId: string | null;
  windowResults: unknown;
  gitCommitHash: string | null;
  notes: string | null;
  createdTime: string | null;
  createdBy: string | null;
}

export interface CrossWindowEnvelope {
  strategyCode: string;
  intervalName: string;
  instrument: string;
  runs: CrossWindowRun[];
  latest: CrossWindowRun | null;
}

export interface ListCrossWindowOpts {
  strategyCode: string;
  intervalName: string;
  instrument: string;
  limit?: number;
}

export async function listCrossWindowRuns(opts: ListCrossWindowOpts): Promise<CrossWindowEnvelope> {
  const { data } = await apiClient.get<CrossWindowEnvelope>('/api/v1/cross-window', {
    params: {
      strategyCode: opts.strategyCode,
      intervalName: opts.intervalName,
      instrument: opts.instrument,
      limit: opts.limit ?? 5,
    },
  });
  return data;
}
