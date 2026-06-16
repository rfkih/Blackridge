import { apiClient } from './client';
import { addOptionalParam } from './queryParams';
import type {
  RegistryFilters,
  RegistryListResponse,
  ResearchRegistryEntry,
} from '@/types/research';

export type {
  ResearchRegistryEntry,
  RegistryListResponse,
  RegistryFilters,
  PromiseTier,
  RegistryVerdictTag,
  RegistryLifecycleStatus,
} from '@/types/research';

/**
 * The registry endpoints live on the research orchestrator and reach the
 * browser through the trading-JVM catch-all proxy at /api/v1/research-orch/**
 * (same path family as ranking.ts / orchestrator.ts) — so they go through
 * `apiClient`, NOT `researchClient`. Admin gating for the write paths is
 * enforced server-side from the proxy-injected X-Viewer-Is-Admin header; the
 * browser sends no admin header itself.
 */
const BASE = '/api/v1/research-orch/strategy-registry';

/**
 * Body shape for create/update. snake_case to match the orchestrator's Pydantic
 * models (which `forbid` extra keys, so camelCase would 422). All fields except
 * the create-required ones are optional; PATCH sends only what changed.
 */
export interface RegistryWriteInput {
  slug?: string;
  rank?: number | null;
  promise_tier?: string;
  display_name?: string;
  signal_family?: string | null;
  strategy_code?: string | null;
  symbol?: string | null;
  interval_name?: string | null;
  verdict_tag?: string;
  lifecycle_status?: string;
  thesis?: string;
  detail?: string | null;
  evidence_iteration_id?: string | null;
  evidence_walk_forward_id?: string | null;
  evidence_backtest_run_id?: string | null;
  journal_id?: string | null;
  memory_ref?: string | null;
  is_offline_lead?: boolean;
  archived?: boolean;
}

export async function listRegistry(filters: RegistryFilters = {}): Promise<RegistryListResponse> {
  const params: Record<string, string | number | boolean> = {};
  addOptionalParam(params, 'tier', filters.tier);
  addOptionalParam(params, 'status', filters.status);
  addOptionalParam(params, 'family', filters.family);
  addOptionalParam(params, 'search', filters.search);
  if (filters.includeArchived) params.include_archived = true;
  const { data } = await apiClient.get<RegistryListResponse>(BASE, { params });
  return data;
}

export async function getRegistryEntry(id: string): Promise<ResearchRegistryEntry> {
  const { data } = await apiClient.get<ResearchRegistryEntry>(`${BASE}/${id}`);
  return data;
}

export async function createRegistryEntry(
  body: RegistryWriteInput,
): Promise<ResearchRegistryEntry> {
  const { data } = await apiClient.post<ResearchRegistryEntry>(BASE, body);
  return data;
}

export async function updateRegistryEntry(
  id: string,
  patch: RegistryWriteInput,
): Promise<ResearchRegistryEntry> {
  const { data } = await apiClient.patch<ResearchRegistryEntry>(`${BASE}/${id}`, patch);
  return data;
}

export async function archiveRegistryEntry(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}
