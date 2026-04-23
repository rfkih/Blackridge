import { apiClient } from './client';

export interface WarmupResult {
  symbol: string;
  interval: string;
  message: string;
}

export interface VcbBackfillResult {
  symbol: string;
  interval: string;
  from: string;
  to: string;
  recordsUpdated: number;
}

export async function backfillHistoricalData(
  symbol: string,
  interval: string,
): Promise<WarmupResult> {
  const { data } = await apiClient.post<WarmupResult>('/api/v1/historical/backfill', null, {
    params: { symbol, interval },
  });
  return data;
}

// Spring's default LocalDateTime format is ISO without the trailing `Z`
// (e.g. `2024-01-15T10:30:00`) — the native <input type="datetime-local">
// value is already in the right shape.
export async function backfillVcbIndicators(
  symbol: string,
  interval: string,
  from: string,
  to: string,
): Promise<VcbBackfillResult> {
  const { data } = await apiClient.post<VcbBackfillResult>(
    '/api/v1/historical/backfill-vcb',
    null,
    { params: { symbol, interval, from, to } },
  );
  return data;
}
