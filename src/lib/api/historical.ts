// Historical data integrity console — coverage, jobs, patchable columns.
//
// All endpoints route through the research JVM (8081). The trading JVM
// reverse-proxies /api/v1/historical/** so both clients hit the same origin.
import { researchClient as apiClient } from './client';
import { addOptionalParam } from './queryParams';

const BASE = '/api/v1/historical';

// ── Coverage report ─────────────────────────────────────────────────────────

export interface CoverageGap {
  /** Last present candle's start_time before the gap. */
  from: string;
  /** Next present candle's start_time after the gap. */
  to: string;
  /** Bars missing between {@code from} and {@code to}. */
  missingBars: number;
}

export interface MarketDataCoverage {
  /** Rows present in market_data within the requested range. */
  actual: number;
  /** Approximate expected count = (to-from)/interval + 1. */
  expected: number;
  /** {@code max(0, expected - actual)}. */
  missing: number;
  /** Number of internal gaps (bars missing between two existing bars). */
  gapCount: number;
  /** Gap list, capped at 100 by the backend. */
  gaps: CoverageGap[];
  earliest: string | null;
  latest: string | null;
}

export interface FeatureStoreCoverage {
  actual: number;
  /** market_data candles in the range that have no feature_store row. */
  missingRows: number;
}

export interface CoverageSanity {
  highLessThanLow: number;
  zeroVolume: number;
  duplicateStartTime: number;
}

export interface CoverageReport {
  symbol: string;
  interval: string;
  /** ISO LocalDateTime, no trailing Z. */
  from: string;
  to: string;
  marketData: MarketDataCoverage;
  featureStore: FeatureStoreCoverage;
  /** Map of column_name → null_row_count. Only non-zero columns are included. */
  nullColumns: Record<string, number>;
  sanity: CoverageSanity;
}

export async function getCoverageReport(
  symbol: string,
  interval: string,
  from?: string,
  to?: string,
): Promise<CoverageReport> {
  const params: Record<string, string | number | boolean> = { symbol, interval };
  addOptionalParam(params, 'from', from);
  addOptionalParam(params, 'to', to);
  const { data } = await apiClient.get<CoverageReport>(`${BASE}/coverage`, { params });
  return data;
}

// ── Patchable columns (auto-discover what FeaturePatcher beans exist) ───────

export interface PatchableColumn {
  column: string;
  writtenColumns: string[];
}

export interface PatchableColumnsResponse {
  columns: PatchableColumn[];
}

export async function getPatchableColumns(): Promise<PatchableColumnsResponse> {
  const { data } = await apiClient.get<PatchableColumnsResponse>(`${BASE}/patchable-columns`);
  return data;
}

// ── Jobs ────────────────────────────────────────────────────────────────────

export type JobType =
  | 'COVERAGE_REPAIR'
  | 'PATCH_NULL_COLUMN'
  | 'RECOMPUTE_RANGE'
  | 'BACKFILL_FUNDING_HISTORY';

export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface HistoricalBackfillJob {
  jobId: string;
  jobType: JobType;
  symbol: string | null;
  interval: string | null;
  /** Opaque JSON document — handler-specific. */
  params: Record<string, unknown> | null;
  status: JobStatus;
  /** Coarse-grained progress label (e.g. "feature_store", "patch:slope_200"). */
  phase: string | null;
  progressDone: number;
  progressTotal: number;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  errorClass: string | null;
  cancelRequested: boolean;
  createdByUserId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SubmitJobRequest {
  jobType: JobType;
  symbol?: string | null;
  interval?: string | null;
  params?: Record<string, unknown>;
}

export async function submitJob(req: SubmitJobRequest): Promise<HistoricalBackfillJob> {
  const { data } = await apiClient.post<HistoricalBackfillJob>(`${BASE}/jobs`, req);
  return data;
}

export async function getJob(jobId: string): Promise<HistoricalBackfillJob> {
  const { data } = await apiClient.get<HistoricalBackfillJob>(`${BASE}/jobs/${jobId}`);
  return data;
}

export async function cancelJob(jobId: string): Promise<HistoricalBackfillJob> {
  const { data } = await apiClient.post<HistoricalBackfillJob>(`${BASE}/jobs/${jobId}/cancel`);
  return data;
}

export async function listJobs(opts?: {
  status?: JobStatus;
  limit?: number;
}): Promise<HistoricalBackfillJob[]> {
  const params: Record<string, string | number | boolean> = {};
  addOptionalParam(params, 'status', opts?.status);
  addOptionalParam(params, 'limit', opts?.limit);
  const { data } = await apiClient.get<HistoricalBackfillJob[]>(`${BASE}/jobs`, { params });
  return data;
}

/** True once the job has reached a terminal state — polling can stop. */
export function isJobTerminal(job: HistoricalBackfillJob | null | undefined): boolean {
  if (!job) return false;
  return job.status === 'SUCCESS' || job.status === 'FAILED' || job.status === 'CANCELLED';
}
