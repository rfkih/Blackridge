import type { Page } from '@/types/api';
import type {
  CreateStrategyDefinitionPayload,
  StrategyDefinition,
  UpdateStrategyDefinitionPayload,
} from '@/types/strategyDefinition';
import { apiClient } from './client';

interface BackendStrategyDefinition {
  strategyDefinitionId: string | null;
  strategyCode: string | null;
  strategyName: string | null;
  strategyType: string | null;
  description: string | null;
  status: string | null;
  archetype: string | null;
  archetypeVersion: number | null;
  specJsonb: Record<string, unknown> | null;
  enabled: boolean | null;
  simulated: boolean | null;
  createdTime: string | null;
  updatedTime: string | null;
}

function map(r: BackendStrategyDefinition): StrategyDefinition {
  return {
    id: r.strategyDefinitionId ?? '',
    strategyCode: r.strategyCode ?? '',
    strategyName: r.strategyName ?? '',
    strategyType: r.strategyType ?? '',
    description: r.description,
    status: (r.status ?? 'ACTIVE') as StrategyDefinition['status'],
    archetype: r.archetype,
    archetypeVersion: r.archetypeVersion,
    specJsonb: r.specJsonb,
    enabled: r.enabled ?? false,
    simulated: r.simulated ?? true,
    createdAt: r.createdTime ?? '',
    updatedAt: r.updatedTime ?? '',
  };
}

const BASE = '/api/v1/strategy-definitions';

export async function listStrategyDefinitions(): Promise<StrategyDefinition[]> {
  // Backwards-compat shape: when called without any pagination params the
  // controller still returns a bare array so existing strategy-picker
  // dropdowns and dialogs (BacktestParamTuner, NewStrategyDialog, etc.)
  // keep working unchanged. Use `searchStrategyDefinitions` for paged use.
  const { data } = await apiClient.get<BackendStrategyDefinition[]>(BASE);
  return (data ?? []).map(map);
}

export interface StrategyDefinitionsQuery {
  /** Substring match against `strategy_code` and `strategy_name` (case-insensitive). */
  query?: string;
  /** Spring sort string — "strategyCode,asc" / "strategyType,desc" / "archetype,asc"
   *  / "createdTime,desc". Backend whitelists the field. */
  sort?: string;
  page?: number;
  size?: number;
}

/**
 * Filterable + paginated counterpart of {@link listStrategyDefinitions}.
 * Backend caps `size` at 100; default 25 matches the dashboard panel size.
 * Empty/blank `query` means "no substring filter".
 */
export async function searchStrategyDefinitions(
  q: StrategyDefinitionsQuery = {},
): Promise<Page<StrategyDefinition>> {
  const params: Record<string, string | number> = {
    page: q.page ?? 0,
    size: q.size ?? 25,
  };
  if (q.query && q.query.trim()) params.query = q.query.trim();
  if (q.sort && q.sort.trim()) params.sort = q.sort.trim();
  const { data } = await apiClient.get<Page<BackendStrategyDefinition>>(BASE, { params });
  return {
    content: (data.content ?? []).map(map),
    totalElements: data.totalElements,
    totalPages: data.totalPages,
    number: data.number,
    size: data.size,
  };
}

export async function getStrategyDefinition(id: string): Promise<StrategyDefinition> {
  const { data } = await apiClient.get<BackendStrategyDefinition>(`${BASE}/${id}`);
  return map(data);
}

export async function createStrategyDefinition(
  payload: CreateStrategyDefinitionPayload,
): Promise<StrategyDefinition> {
  const { data } = await apiClient.post<BackendStrategyDefinition>(BASE, payload);
  return map(data);
}

export async function updateStrategyDefinition(
  id: string,
  payload: UpdateStrategyDefinitionPayload,
): Promise<StrategyDefinition> {
  const { data } = await apiClient.patch<BackendStrategyDefinition>(`${BASE}/${id}`, payload);
  return map(data);
}

export async function deprecateStrategyDefinition(id: string): Promise<StrategyDefinition> {
  // DELETE is intentionally a soft-delete: the service flips status to
  // DEPRECATED so historical account_strategy / backtest_run rows still
  // resolve their strategy metadata.
  const { data } = await apiClient.delete<BackendStrategyDefinition>(`${BASE}/${id}`);
  return map(data);
}
