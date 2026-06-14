
import { researchClient as apiClient } from './client';
import type {
  MlIngestSchedule,
  MlSourceHealth,
  TriggerMlBackfillRequest,
  UpdateMlScheduleRequest,
} from '@/types/mlIngest';
import type { HistoricalBackfillJob } from './historical';

const BASE = '/api/v1/ml-ingest';

export async function listMlSchedules(): Promise<MlIngestSchedule[]> {
  const { data } = await apiClient.get<MlIngestSchedule[]>(`${BASE}/schedules`);
  return data;
}

export async function updateMlSchedule(
  id: number,
  req: UpdateMlScheduleRequest,
): Promise<MlIngestSchedule> {
  const { data } = await apiClient.patch<MlIngestSchedule>(`${BASE}/schedules/${id}`, req);
  return data;
}

export async function listMlSourceHealth(): Promise<MlSourceHealth[]> {
  const { data } = await apiClient.get<MlSourceHealth[]>(`${BASE}/health`);
  return data;
}

/**
 * Returns the freshly-inserted HistoricalBackfillJob row. Caller should then
 * poll `getJob(jobId)` from `@/lib/api/historical` for live progress — the
 * job lives in the same table as every other backfill.
 */
export async function triggerMlBackfill(
  req: TriggerMlBackfillRequest,
): Promise<HistoricalBackfillJob> {
  const { data } = await apiClient.post<HistoricalBackfillJob>(`${BASE}/backfill`, req);
  return data;
}
