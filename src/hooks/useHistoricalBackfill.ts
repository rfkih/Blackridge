'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelJob,
  getCoverageReport,
  getJob,
  getPatchableColumns,
  isJobTerminal,
  listJobs,
  submitJob,
  type CoverageReport,
  type HistoricalBackfillJob,
  type JobStatus,
  type PatchableColumnsResponse,
  type SubmitJobRequest,
} from '@/lib/api/historical';

const COVERAGE_KEY = 'historical:coverage';
const PATCHABLE_KEY = 'historical:patchable-columns';
const JOB_KEY = 'historical:job';
const JOBS_KEY = 'historical:jobs';

/** Poll active jobs at this cadence — fast enough to feel live, light on Postgres. */
const ACTIVE_JOB_POLL_MS = 1500;

interface CoverageQueryArgs {
  symbol: string;
  interval: string;
  from?: string;
  to?: string;
  /** When false the query stays disabled — used while the form is incomplete. */
  enabled?: boolean;
}

export function useCoverageReport(args: CoverageQueryArgs) {
  const { symbol, interval, from, to, enabled = true } = args;
  return useQuery<CoverageReport>({
    queryKey: [COVERAGE_KEY, symbol, interval, from ?? null, to ?? null],
    queryFn: () => getCoverageReport(symbol, interval, from, to),
    enabled: enabled && symbol.length >= 3 && interval.length > 0,

    staleTime: 10_000,
  });
}

export function usePatchableColumns() {
  return useQuery<PatchableColumnsResponse>({
    queryKey: [PATCHABLE_KEY],
    queryFn: getPatchableColumns,

    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSubmitJob() {
  const qc = useQueryClient();
  return useMutation<HistoricalBackfillJob, Error, SubmitJobRequest>({
    mutationFn: submitJob,
    onSuccess: (job) => {
      qc.setQueryData([JOB_KEY, job.jobId], job);
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}

export function useJob(jobId: string | null | undefined) {
  return useQuery<HistoricalBackfillJob>({
    queryKey: [JOB_KEY, jobId ?? null],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,

    refetchInterval: (query) => (isJobTerminal(query.state.data) ? false : ACTIVE_JOB_POLL_MS),
    refetchIntervalInBackground: false,
  });
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation<HistoricalBackfillJob, Error, string>({
    mutationFn: cancelJob,
    onSuccess: (job) => {
      qc.setQueryData([JOB_KEY, job.jobId], job);
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}

export function useListJobs(opts?: { status?: JobStatus; limit?: number }) {
  return useQuery<HistoricalBackfillJob[]>({
    queryKey: [JOBS_KEY, opts?.status ?? null, opts?.limit ?? 20],
    queryFn: () => listJobs({ status: opts?.status, limit: opts?.limit ?? 20 }),

    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}
