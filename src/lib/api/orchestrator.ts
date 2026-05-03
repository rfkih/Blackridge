// Read access to the Python research orchestrator (FastAPI on 127.0.0.1:8082)
// via the trading-JVM proxy at /api/v1/research-orch/**. Admin-gated server-
// side; the X-Orch-Token shared secret never leaves the JVM host.
//
// Only read paths exposed today. Write paths (POST /tick, /walk-forward,
// /queue) stay agent-only — the dashboard surfaces results, not control.
import { apiClient } from './client';
import type {
  EnqueueSweepRequest,
  IterationRow,
  IterationsPage,
  JournalPage,
  JournalRow,
  LeaderboardResponse,
  LeaderboardRow,
  QueuePage,
  QueueRow,
  QueueStatus,
} from '@/types/orchestrator';

const BASE = '/api/v1/research-orch';

export async function getLeaderboard(params?: {
  strategyCode?: string;
  significantOnly?: boolean;
  sort?: 'pf' | 'return_pct' | 'sharpe' | 'trade_count' | 'created';
  limit?: number;
}): Promise<LeaderboardRow[]> {
  const { data } = await apiClient.get<LeaderboardResponse>(`${BASE}/leaderboard`, {
    params: {
      strategy_code: params?.strategyCode || undefined,
      significant_only: params?.significantOnly ?? undefined,
      sort: params?.sort || undefined,
      limit: params?.limit ?? 15,
    },
  });
  return data.items;
}

export async function listIterations(params?: {
  strategyCode?: string;
  verdict?: 'PASS' | 'ITERATE' | 'DISCARD' | 'FAILED';
  limit?: number;
}): Promise<IterationRow[]> {
  const { data } = await apiClient.get<IterationsPage>(`${BASE}/iterations`, {
    params: {
      strategy_code: params?.strategyCode || undefined,
      verdict: params?.verdict || undefined,
      limit: params?.limit ?? 20,
    },
  });
  return data.items;
}

/**
 * Cursor-aware iterations fetcher — returns the full page envelope including
 * `next_cursor` so the caller can implement Next-page navigation. Cursor
 * pagination doesn't natively support Prev; emulate with a cursor stack on
 * the consumer side (push on Next, pop on Prev).
 */
export async function searchIterations(params?: {
  strategyCode?: string;
  verdict?: 'PASS' | 'ITERATE' | 'DISCARD' | 'FAILED';
  cursor?: string | null;
  limit?: number;
}): Promise<IterationsPage> {
  const { data } = await apiClient.get<IterationsPage>(`${BASE}/iterations`, {
    params: {
      strategy_code: params?.strategyCode || undefined,
      verdict: params?.verdict || undefined,
      cursor: params?.cursor || undefined,
      limit: params?.limit ?? 25,
    },
  });
  return data;
}

export async function getIteration(iterationId: string): Promise<IterationRow> {
  const { data } = await apiClient.get<IterationRow>(`${BASE}/iterations/${iterationId}`);
  return data;
}

/**
 * Walk-forward candidates: queue rows parked at PARKED with a
 * SIGNIFICANT_EDGE final verdict. The orchestrator doesn't expose a combined
 * filter, so we fetch PARKED and post-filter client-side. Volume is small
 * (one row per parked sweep awaiting validation).
 */
export async function listWalkForwardCandidates(limit = 25): Promise<QueueRow[]> {
  const { data } = await apiClient.get<QueuePage>(`${BASE}/queue`, {
    params: { status: 'PARKED', limit },
  });
  return data.items.filter((r) => r.final_verdict === 'SIGNIFICANT_EDGE');
}

export async function listQueue(params?: {
  status?: QueueStatus;
  strategyCode?: string;
  limit?: number;
}): Promise<QueueRow[]> {
  const { data } = await apiClient.get<QueuePage>(`${BASE}/queue`, {
    params: {
      status: params?.status || undefined,
      strategy_code: params?.strategyCode || undefined,
      limit: params?.limit ?? 50,
    },
  });
  return data.items;
}

export async function listJournal(params?: {
  entryType?: string;
  status?: string;
  strategyCode?: string;
  search?: string;
  limit?: number;
}): Promise<JournalRow[]> {
  const { data } = await apiClient.get<JournalPage>(`${BASE}/journal`, {
    params: {
      entry_type: params?.entryType || undefined,
      status: params?.status || undefined,
      strategy_code: params?.strategyCode || undefined,
      search: params?.search || undefined,
      limit: params?.limit ?? 25,
    },
  });
  return data.items;
}

/**
 * Fire one orchestrator iteration end-to-end (claim → submit → poll → analyse).
 * Synchronous; up to ~30 min. Browser holds the connection open while the
 * orchestrator works; the JVM proxy timeout is sized for this.
 *
 * Idempotency-Key dedupes accidental double-clicks across the proxy + orch.
 */
export async function runTick(idempotencyKey: string): Promise<IterationRow> {
  const { data } = await apiClient.post<IterationRow>(
    `${BASE}/tick`,
    {},
    { headers: { 'Idempotency-Key': idempotencyKey }, timeout: 35 * 60 * 1000 },
  );
  return data;
}

export async function enqueueSweep(
  body: EnqueueSweepRequest,
  idempotencyKey: string,
): Promise<QueueRow> {
  const { data } = await apiClient.post<QueueRow>(`${BASE}/queue`, body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data;
}
