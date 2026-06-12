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
import { toNum, toNumOrNull } from './coerce';
import { generateIdempotencyKey } from '@/lib/idempotency';
import type {
  ApplyMlGateRequest,
  DailyCountsResponse,
  FiringsResponse,
  MlGateConfig,
  MlModel,
  MlMonitorResponse,
  ModelInfo,
  ModelListResponse,
  SignalDetail,
  SignalHealth,
  SignalListResponse,
  SignalSource,
  SignalStatus,
  StreamingStatus,
  WalkForwardSummary,
} from '@/types/ml';

const ORCH = '/api/v1/research-orch';
const TRADING = '/api/v1/account-strategies';

/**
 * Wire variant of a domain shape: numeric fields may arrive as strings
 * (Pydantic/Jackson serialize decimals as number-or-string). Every fetch
 * wrapper coerces through {@link toNum}/{@link toNumOrNull} at this boundary
 * so components never call `.toFixed()` on a string.
 */
type NumbersAsStrings<T> = {
  [K in keyof T]: T[K] extends number
    ? number | string
    : T[K] extends number | null
      ? number | string | null
      : T[K];
};

// ── raw axios wrappers ─────────────────────────────────────────────────────

type MlMonitorRowWire = NumbersAsStrings<MlMonitorResponse['rows'][number]>;

async function fetchMlMonitor(): Promise<MlMonitorResponse> {
  const { data } = await apiClient.get<{ rows: MlMonitorRowWire[]; generatedAt: string }>(
    `${ORCH}/ml/monitor`,
  );
  return {
    generatedAt: data.generatedAt,
    rows: (data.rows ?? []).map((r) => ({
      ...r,
      walkforwardAuc: toNumOrNull(r.walkforwardAuc),
      coverage7dRatio: toNumOrNull(r.coverage7dRatio),
      fires24h: toNum(r.fires24h),
    })),
  };
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
  return { ...data, total: toNum(data.total) };
}

type SignalHealthWire = NumbersAsStrings<SignalHealth>;
type ModelInfoWire = Omit<NumbersAsStrings<ModelInfo>, 'walkForward' | 'featureImportance'> & {
  walkForward: NumbersAsStrings<WalkForwardSummary> | null;
  featureImportance: Record<string, number | string> | null;
};
type SignalDetailWire = Omit<SignalDetail, 'health' | 'model'> & {
  health: SignalHealthWire;
  model: ModelInfoWire | null;
};

function mapSignalHealth(h: SignalHealthWire): SignalHealth {
  return {
    ...h,
    lastFireAgeSeconds: toNumOrNull(h.lastFireAgeSeconds),
    expectedFireSeconds: toNumOrNull(h.expectedFireSeconds),
    featureAgeHours: toNumOrNull(h.featureAgeHours),
    coverage7dRatio: toNumOrNull(h.coverage7dRatio),
    fires24h: toNum(h.fires24h),
    fires7d: toNum(h.fires7d),
    walkforwardAuc: toNumOrNull(h.walkforwardAuc),
  };
}

function mapModelInfo(m: ModelInfoWire): ModelInfo {
  return {
    ...m,
    nTrainRows: toNumOrNull(m.nTrainRows),
    nValRows: toNumOrNull(m.nValRows),
    auc: toNumOrNull(m.auc),
    accuracy: toNumOrNull(m.accuracy),
    logLoss: toNumOrNull(m.logLoss),
    adversarialAuc: toNumOrNull(m.adversarialAuc),
    leakageMaxPearson: toNumOrNull(m.leakageMaxPearson),
    walkForward: m.walkForward
      ? {
          nFolds: toNum(m.walkForward.nFolds),
          primaryMetric: m.walkForward.primaryMetric,
          primaryMean: toNum(m.walkForward.primaryMean),
          primaryMedian: toNum(m.walkForward.primaryMedian),
          primaryStd: toNum(m.walkForward.primaryStd),
        }
      : null,
    featureImportance: Object.fromEntries(
      Object.entries(m.featureImportance ?? {}).map(([k, v]) => [k, toNum(v)]),
    ),
  };
}

async function fetchSignal(signalId: string): Promise<SignalDetail> {
  const { data } = await apiClient.get<SignalDetailWire>(`${ORCH}/signals/${signalId}`);
  return {
    ...data,
    health: mapSignalHealth(data.health),
    model: data.model ? mapModelInfo(data.model) : null,
  };
}

export interface FiringsParams {
  since?: string;
  until?: string;
  source?: SignalSource;
  limit?: number;
  offset?: number;
}

type FiringRowWire = NumbersAsStrings<FiringsResponse['firings'][number]>;

async function fetchFirings(signalId: string, params: FiringsParams): Promise<FiringsResponse> {
  const { data } = await apiClient.get<{
    firings: FiringRowWire[];
    total: number | string;
    limit: number;
    offset: number;
  }>(`${ORCH}/signals/${signalId}/firings`, {
    params: {
      since: params.since,
      until: params.until,
      source: params.source,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    },
  });
  return {
    ...data,
    total: toNum(data.total),
    firings: (data.firings ?? []).map((f) => ({
      ...f,
      value: toNum(f.value),
      confidence: toNumOrNull(f.confidence),
    })),
  };
}

async function fetchDailyCounts(signalId: string, days = 30): Promise<DailyCountsResponse> {
  const { data } = await apiClient.get<{
    days: NumbersAsStrings<DailyCountsResponse['days'][number]>[];
  }>(`${ORCH}/signals/${signalId}/daily-counts`, { params: { days } });
  return { days: (data.days ?? []).map((d) => ({ ...d, fireCount: toNum(d.fireCount) })) };
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
  horizon_bars: number | string | null;
  status: string;
  version: number | string;
  artifact_sha256: string | null;
  artifact_size_bytes: number | string | null;
  created_time: string;
  created_by: string | null;
  metrics: Record<string, unknown> | null;
}

interface ModelsSnakeResponse {
  models: ModelRowSnake[];
  total: number | string;
  limit: number;
  offset: number;
}

function mapModelRow(m: ModelRowSnake): MlModel {
  return {
    id: m.id,
    family: m.family,
    purpose: m.purpose,
    symbol: m.symbol,
    interval: m.interval,
    horizonBars: toNumOrNull(m.horizon_bars),
    status: m.status as MlModel['status'],
    version: toNum(m.version),
    artifactSha256: m.artifact_sha256,
    artifactSizeBytes: toNumOrNull(m.artifact_size_bytes),
    createdTime: m.created_time,
    createdBy: m.created_by,
    metrics: m.metrics,
  };
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
    models: data.models.map(mapModelRow),
    total: toNum(data.total),
    limit: data.limit,
    offset: data.offset,
  };
}

/** Single-model detail — same raw asyncpg snake_case shape as the list. */
async function fetchModel(modelId: string): Promise<MlModel> {
  const { data } = await apiClient.get<ModelRowSnake>(`${ORCH}/models/${modelId}`);
  return mapModelRow(data);
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
    placeholderData: (prev) => prev,
  });
}

/** Returns a sorted list of signal names for active and shadow signals.
 *  Used by the backtest wizard to populate the ML signal name dropdown.
 *  Returns an empty array (no error) when the orchestrator is unreachable.
 *
 *  Status filtering is server-side (one request per status — the endpoint
 *  takes a single `status` param); the previous fetch-200-then-filter
 *  approach silently dropped active signals past the limit. */
export function useSignalNames(): string[] {
  const { data } = useQuery({
    queryKey: ['ml', 'signal-names'] as const,
    queryFn: async () => {
      const [active, shadow] = await Promise.all([
        fetchSignals({ status: 'active', limit: 1000 }),
        fetchSignals({ status: 'shadow', limit: 1000 }),
      ]);
      const names = new Set([
        ...active.signals.map((r) => r.signalName),
        ...shadow.signals.map((r) => r.signalName),
      ]);
      return Array.from(names).sort();
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
    placeholderData: (prev) => prev,
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
    placeholderData: (prev) => prev,
  });
}

export function useModel(modelId: string | undefined) {
  return useQuery({
    queryKey: ['ml', 'model', modelId] as const,
    queryFn: () => fetchModel(modelId!),
    enabled: !!modelId,
    staleTime: 60_000,
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
