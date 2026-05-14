'use client';

// Hooks for the ML/sentiment ingestion admin console (V67).
//
// The page composes:
//   useMlSchedules   → list cron schedules
//   useMlSourceHealth → 7 cards on the dashboard, polled every 30s
//   useUpdateMlSchedule → cron / enabled / lookback / config edits
//   useTriggerMlBackfill → kick off historical backfill (delegates to
//                         existing `historical_backfill_job` machinery)
//
// The job-polling helpers (useJob, useCancelJob) come from
// `@/hooks/useHistoricalBackfill` — no duplication.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listMlSchedules,
  listMlSourceHealth,
  triggerMlBackfill,
  updateMlSchedule,
} from '@/lib/api/mlIngest';
import type {
  MlIngestSchedule,
  MlSourceHealth,
  TriggerMlBackfillRequest,
  UpdateMlScheduleRequest,
} from '@/types/mlIngest';
import type { HistoricalBackfillJob } from '@/lib/api/historical';

const SCHEDULES_KEY = 'ml-ingest:schedules';
const HEALTH_KEY = 'ml-ingest:health';

/** Health poll cadence — frequent enough to feel live, light on the backend. */
const HEALTH_POLL_MS = 30_000;
/** Schedules change rarely; only refetch on focus or after a mutation. */
const SCHEDULES_STALE_MS = 60_000;

export function useMlSchedules() {
  return useQuery<MlIngestSchedule[]>({
    queryKey: [SCHEDULES_KEY],
    queryFn: listMlSchedules,
    staleTime: SCHEDULES_STALE_MS,
  });
}

export function useMlSourceHealth() {
  return useQuery<MlSourceHealth[]>({
    queryKey: [HEALTH_KEY],
    queryFn: listMlSourceHealth,
    refetchInterval: HEALTH_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useUpdateMlSchedule() {
  const qc = useQueryClient();
  return useMutation<
    MlIngestSchedule,
    Error,
    { id: number; req: UpdateMlScheduleRequest }
  >({
    mutationFn: ({ id, req }) => updateMlSchedule(id, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SCHEDULES_KEY] });
    },
  });
}

export function useTriggerMlBackfill() {
  const qc = useQueryClient();
  return useMutation<HistoricalBackfillJob, Error, TriggerMlBackfillRequest>({
    mutationFn: triggerMlBackfill,
    onSuccess: (job) => {
      // Prime the historical-job cache so the progress drawer can pick up
      // the PENDING row immediately without a flash of loading state.
      qc.setQueryData(['historical:job', job.jobId], job);
      qc.invalidateQueries({ queryKey: ['historical:jobs'] });
      qc.invalidateQueries({ queryKey: [HEALTH_KEY] });
    },
  });
}
