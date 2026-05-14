// ML/sentiment ingestion control plane (V67) — admin-only.
//
// Backend lives in the research JVM (8081) like the historical-backfill
// console — both routed through researchClient. Manual backfills route
// through the existing `historical_backfill_job` table via a thin trigger
// endpoint; the frontend polls `/api/v1/historical/jobs/{id}` (existing
// helper) for live progress instead of duplicating polling logic here.

import { researchClient as apiClient } from './client';
import type {
  MlIngestSchedule,
  MlSourceHealth,
  TriggerMlBackfillRequest,
  UpdateMlScheduleRequest,
} from '@/types/mlIngest';
import type { HistoricalBackfillJob } from './historical';

const BASE = '/api/v1/ml-ingest';

// ── Schedules ───────────────────────────────────────────────────────────────

export async function listMlSchedules(): Promise<MlIngestSchedule[]> {
  const { data } = await apiClient.get<MlIngestSchedule[]>(`${BASE}/schedules`);
  return data;
}

export async function getMlSchedule(id: number): Promise<MlIngestSchedule> {
  const { data } = await apiClient.get<MlIngestSchedule>(`${BASE}/schedules/${id}`);
  return data;
}

export async function updateMlSchedule(
  id: number,
  req: UpdateMlScheduleRequest,
): Promise<MlIngestSchedule> {
  const { data } = await apiClient.patch<MlIngestSchedule>(`${BASE}/schedules/${id}`, req);
  return data;
}

// ── Source health ───────────────────────────────────────────────────────────

export async function listMlSourceHealth(): Promise<MlSourceHealth[]> {
  const { data } = await apiClient.get<MlSourceHealth[]>(`${BASE}/health`);
  return data;
}

// ── Manual backfill trigger ─────────────────────────────────────────────────

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

// ── Discovery: known source list ────────────────────────────────────────────

export async function listKnownMlSources(): Promise<string[]> {
  const { data } = await apiClient.get<{ sources: string[] }>(`${BASE}/sources`);
  return data.sources;
}
