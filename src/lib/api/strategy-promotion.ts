// Frontend client for /api/v1/strategy-promotion. Admin-only on the
// backend; calls here will 403 for non-admin users (the /research page
// gates the route on `useIsAdmin`, so the 403 path is rare).
//
// Routes through `apiClient` because StrategyPromotionController lives
// on the trading JVM (it mutates account_strategy state).
import { apiClient } from './client';
import type { ISO8601, UUID } from '@/types/api';

export type PromotionState = 'RESEARCH' | 'PAPER_TRADE' | 'PROMOTED' | 'DEMOTED' | 'REJECTED';

export interface PromoteRequest {
  toState: PromotionState;
  reason: string;
  /** Free-form JSON snapshot of supporting evidence (sweep IDs, metrics,
   *  paper-trade window). Stored verbatim in `strategy_promotion_log.evidence`. */
  evidence?: unknown;
}

export interface PromoteResponse {
  promotionId: UUID;
  fromState: PromotionState;
  toState: PromotionState;
  reviewerUserId: UUID;
  createdTime: ISO8601;
}

export interface StrategyPromotionLog {
  promotionId: UUID;
  /** Set for account-scoped (V15) rows; null for definition-scoped (V40) rows. */
  accountStrategyId: UUID | null;
  /** Set for definition-scoped (V40) rows; null for account-scoped rows. */
  strategyDefinitionId?: UUID | null;
  strategyCode: string;
  fromState: PromotionState;
  toState: PromotionState;
  reviewerUserId: UUID | null;
  reason: string;
  evidence?: unknown;
  createdTime: ISO8601;
}

export interface PaperTradeRun {
  paperTradeId: UUID;
  accountStrategyId: UUID;
  strategyCode: string;
  symbol: string;
  intervalName: string;
  decisionType: string;
  side: 'LONG' | 'SHORT' | null;
  intendedPrice: number | string | null;
  intendedQuantity: number | string | null;
  intendedNotionalUsdt: number | string | null;
  stopLossPrice: number | string | null;
  takeProfitPrice: number | string | null;
  skipReason: string | null;
  createdTime: ISO8601;
}

const BASE = '/api/v1/strategy-promotion';

export async function promote(
  accountStrategyId: UUID,
  body: PromoteRequest,
): Promise<PromoteResponse> {
  const { data } = await apiClient.post<PromoteResponse>(
    `${BASE}/${accountStrategyId}/promote`,
    body,
  );
  return data;
}

export async function getCurrentState(accountStrategyId: UUID): Promise<PromotionState> {
  const { data } = await apiClient.get<{ state: PromotionState }>(
    `${BASE}/${accountStrategyId}/state`,
  );
  return data.state;
}

export async function getPromotionHistory(
  accountStrategyId: UUID,
): Promise<StrategyPromotionLog[]> {
  const { data } = await apiClient.get<StrategyPromotionLog[]>(
    `${BASE}/${accountStrategyId}/history`,
  );
  return data;
}

export async function getPaperTrades(accountStrategyId: UUID): Promise<PaperTradeRun[]> {
  const { data } = await apiClient.get<PaperTradeRun[]>(
    `${BASE}/${accountStrategyId}/paper-trades`,
  );
  return data;
}

/**
 * Cross-strategy promotions feed for the /research dashboard. Backend caps
 * `limit` at 200; default 50 matches the dashboard panel size.
 */
export async function getRecentPromotions(limit = 50): Promise<StrategyPromotionLog[]> {
  const { data } = await apiClient.get<StrategyPromotionLog[]>(`${BASE}/recent`, {
    params: { limit },
  });
  return data;
}

export interface RecentPromotionsQuery {
  strategyCode?: string;
  toState?: PromotionState;
  page?: number;
  size?: number;
}

export interface RecentPromotionsPage {
  content: StrategyPromotionLog[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * Filterable + paginated counterpart of {@link getRecentPromotions}. Backend
 * page-size cap is 100. Empty/blank `strategyCode` and `toState` mean
 * "no filter on that column".
 */
export async function searchRecentPromotions(
  q: RecentPromotionsQuery = {},
): Promise<RecentPromotionsPage> {
  const params: Record<string, string | number> = {
    page: q.page ?? 0,
    size: q.size ?? 25,
  };
  if (q.strategyCode && q.strategyCode.trim()) params.strategyCode = q.strategyCode.trim();
  if (q.toState) params.toState = q.toState;
  const { data } = await apiClient.get<RecentPromotionsPage>(`${BASE}/recent/search`, {
    params,
  });
  return data;
}

/**
 * Derive promotion state from `enabled` + `simulated`. Source of truth is
 * `strategy_promotion_log` (server-side `getCurrentState`), but this is
 * useful client-side for grouping the candidates table without N round-trips.
 *
 * Caveat: this can't distinguish RESEARCH vs DEMOTED vs REJECTED — all three
 * have `enabled=false, simulated=false`. The dashboard renders them as a
 * single "Inactive" bucket and surfaces the precise state via the recent-
 * promotions feed.
 */
export type DerivedPromotionState = 'PROMOTED' | 'PAPER_TRADE' | 'INACTIVE';

export function derivePromotionState(enabled: boolean, simulated: boolean): DerivedPromotionState {
  if (enabled && simulated) return 'PAPER_TRADE';
  if (enabled && !simulated) return 'PROMOTED';
  return 'INACTIVE';
}

// ── definition-scope (V40) ────────────────────────────────────────────────
//
// The promotion lifecycle is now a property of the strategy itself. The
// /research panel drives off these endpoints; per-account endpoints above
// stay for back-compat.

export async function promoteDefinition(
  strategyCode: string,
  body: PromoteRequest,
): Promise<PromoteResponse & { strategyCode: string }> {
  const { data } = await apiClient.post<PromoteResponse & { strategyCode: string }>(
    `${BASE}/definition/${encodeURIComponent(strategyCode)}/promote`,
    body,
  );
  return data;
}

export async function getDefinitionState(strategyCode: string): Promise<PromotionState> {
  const { data } = await apiClient.get<{ strategyCode: string; state: PromotionState }>(
    `${BASE}/definition/${encodeURIComponent(strategyCode)}/state`,
  );
  return data.state;
}

export async function getDefinitionHistory(strategyCode: string): Promise<StrategyPromotionLog[]> {
  const { data } = await apiClient.get<StrategyPromotionLog[]>(
    `${BASE}/definition/${encodeURIComponent(strategyCode)}/history`,
  );
  return data;
}
