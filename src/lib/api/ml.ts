/**
 * ML visibility API client + TanStack hooks (Phase 1, 2026-05-23).
 *
 * Read paths hit the orchestrator via the trading-JVM reverse proxy at
 * `/api/v1/research-orch/*`. ML-gate writes hit the trading JVM directly
 * at `/api/v1/account-strategies/{id}/ml-gate` (the trading JVM owns
 * `account_strategy` writes — proxying would bypass audit + cache).
 *
 * Query keys are namespaced `['ml', resource, …]` so they live alongside
 * the existing `['strategies', code]` cache without collisions.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import { generateIdempotencyKey } from '@/lib/idempotency';
import type {
  ApplyMlGateRequest,
  DailyCountsResponse,
  FiringsResponse,
  MlGateConfig,
  MlMonitorResponse,
  ModelListResponse,
  SignalDetail,
  SignalListResponse,
  SignalSource,
  SignalStatus,
  StreamingStatus,
} from '@/types/ml';

const ORCH = '/api/v1/research-orch';
const TRADING = '/api/v1/account-strategies';

// ── raw axios wrappers ─────────────────────────────────────────────────────

async function fetchMlMonitor(): Promise<MlMonitorResponse> {
  const { data } = await apiClient.get<MlMonitorResponse>(`${ORCH}/ml/monitor`);
  return data;
}

async function fetchStreamingStatus(): Promise<StreamingStatus> {
  const { data } = await apiClient.get<StreamingStatus>(`${ORCH}/ml/streaming-status`);
  return data;
}

export interface SignalsListParams {
  status?: SignalStatus;
  symbol?: string;
  intervalName?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

async function fetchSignals(params: SignalsListParams): Promise<SignalListResponse> {
  const { data } = await apiClient.get<SignalListResponse>(`${ORCH}/signals`, {
    params: {
      status: params.status,
      symbol: params.symbol,
      intervalName: params.intervalName,
      q: params.q,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });
  return data;
}

async function fetchSignal(signalId: string): Promise<SignalDetail> {
  const { data } = await apiClient.get<SignalDetail>(`${ORCH}/signals/${signalId}`);
  return data;
}

export interface FiringsParams {
  since?: string;
  until?: string;
  source?: SignalSource;
  limit?: number;
  offset?: number;
}

async function fetchFirings(signalId: string, params: FiringsParams): Promise<FiringsResponse> {
  const { data } = await apiClient.get<FiringsResponse>(`${ORCH}/signals/${signalId}/firings`, {
    params: {
      since: params.since,
      until: params.until,
      source: params.source,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });
  return data;
}

async function fetchDailyCounts(signalId: string, days = 30): Promise<DailyCountsResponse> {
  const { data } = await apiClient.get<DailyCountsResponse>(
    `${ORCH}/signals/${signalId}/daily-counts`,
    { params: { days } },
  );
  return data;
}

export interface ModelsListParams {
  status?: string;
  purpose?: string;
  symbol?: string;
  limit?: number;
  offset?: number;
}

/** Raw snake_case row shape the orchestrator returns. The existing
 * `/models` handler ships raw asyncpg dicts, predating the camelCase
 * Pydantic models on the /signals + /ml/monitor endpoints. Map at the
 * client boundary so the UI consumes one consistent shape. */
interface ModelRowSnake {
  id: string;
  family: string;
  purpose: string;
  symbol: string | null;
  interval: string | null;
  horizon_bars: number | null;
  status: string;
  version: number;
  artifact_sha256: string | null;
  artifact_size_bytes: number | null;
  created_time: string;
  created_by: string | null;
  metrics: Record<string, unknown> | null;
}

interface ModelsSnakeResponse {
  models: ModelRowSnake[];
  total: number;
  limit: number;
  offset: number;
}

async function fetchModels(params: ModelsListParams): Promise<ModelListResponse> {
  const { data } = await apiClient.get<ModelsSnakeResponse>(`${ORCH}/models`, {
    params: {
      status: params.status,
      purpose: params.purpose,
      symbol: params.symbol,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });
  return {
    models: data.models.map((m) => ({
      id: m.id,
      family: m.family,
      purpose: m.purpose,
      symbol: m.symbol,
      interval: m.interval,
      horizonBars: m.horizon_bars,
      status: m.status as ModelListResponse['models'][number]['status'],
      version: m.version,
      artifactSha256: m.artifact_sha256,
      artifactSizeBytes: m.artifact_size_bytes,
      createdTime: m.created_time,
      createdBy: m.created_by,
      metrics: m.metrics,
    })),
    total: data.total,
    limit: data.limit,
    offset: data.offset,
  };
}

async function fetchMlGate(accountStrategyId: string): Promise<MlGateConfig> {
  const { data } = await apiClient.get<MlGateConfig>(`${TRADING}/${accountStrategyId}/ml-gate`);
  return data;
}

async function applyMlGate(
  accountStrategyId: string,
  body: ApplyMlGateRequest,
): Promise<MlGateConfig> {
  const { data } = await apiClient.post<MlGateConfig>(
    `${TRADING}/${accountStrategyId}/ml-gate`,
    body,
    {
      headers: {
        'Idempotency-Key': generateIdempotencyKey(`apply-mlgate-${accountStrategyId}`),
      },
    },
  );
  return data;
}

// ── TanStack hooks ─────────────────────────────────────────────────────────

export function useStreamingStatus() {
  return useQuery({
    queryKey: ['ml', 'streaming-status'] as const,
    queryFn: fetchStreamingStatus,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 0,
  });
}

export function useMlMonitor() {
  return useQuery({
    queryKey: ['ml', 'monitor'] as const,
    queryFn: fetchMlMonitor,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useSignals(params: SignalsListParams) {
  return useQuery({
    queryKey: ['ml', 'signals', params] as const,
    queryFn: () => fetchSignals(params),
    staleTime: 30_000,
  });
}

/** Returns a sorted list of signal names for active and shadow signals.
 *  Used by the backtest wizard to populate the ML signal name dropdown.
 *  Returns an empty array (no error) when the orchestrator is unreachable. */
export function useSignalNames(): string[] {
  const { data } = useQuery({
    queryKey: ['ml', 'signal-names'] as const,
    queryFn: async () => {
      const res = await fetchSignals({ status: undefined, limit: 200 });
      return res.signals
        .filter((r) => r.status === 'active' || r.status === 'shadow')
        .map((r) => r.signalName)
        .sort();
    },
    staleTime: 60_000,
    retry: 0,
  });
  return data ?? [];
}

export function useSignal(signalId: string | undefined) {
  return useQuery({
    queryKey: ['ml', 'signal', signalId] as const,
    queryFn: () => fetchSignal(signalId!),
    enabled: !!signalId,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useSignalFirings(signalId: string | undefined, params: FiringsParams) {
  return useQuery({
    queryKey: ['ml', 'signal', signalId, 'firings', params] as const,
    queryFn: () => fetchFirings(signalId!, params),
    enabled: !!signalId,
    staleTime: 30_000,
  });
}

export function useSignalDailyCounts(signalId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['ml', 'signal', signalId, 'daily-counts', days] as const,
    queryFn: () => fetchDailyCounts(signalId!, days),
    enabled: !!signalId,
    staleTime: 5 * 60_000,
  });
}

export function useModels(params: ModelsListParams) {
  return useQuery({
    queryKey: ['ml', 'models', params] as const,
    queryFn: () => fetchModels(params),
    staleTime: 30_000,
  });
}

export function useMlGate(accountStrategyId: string | undefined) {
  return useQuery({
    queryKey: ['ml', 'gate', accountStrategyId] as const,
    queryFn: () => fetchMlGate(accountStrategyId!),
    enabled: !!accountStrategyId,
    staleTime: 60_000,
    // Config endpoint, not real-time. Refetching on focus clobbers
    // in-progress form edits in MlGateTab via the form.reset effect.
    refetchOnWindowFocus: false,
  });
}

export function useApplyMlGate(accountStrategyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ApplyMlGateRequest) => applyMlGate(accountStrategyId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml', 'gate', accountStrategyId] });
      qc.invalidateQueries({ queryKey: ['ml', 'monitor'] });
      qc.invalidateQueries({ queryKey: ['ml', 'signals'] });
    },
  });
}
