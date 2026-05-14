// Frontend client for /api/v1/strategy-promotion. Admin-only on the
// backend; calls here will 403 for non-admin users (the /research page
// gates the route on `useIsAdmin`, so the 403 path is rare).
//
// Routes through `apiClient` because StrategyPromotionController lives
// on the trading JVM (it mutates account_strategy state).
import { apiClient } from './client';
import type { ISO8601, Page, UUID } from '@/types/api';

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

export async function getPaperTrades(accountStrategyId: UUID): Promise<PaperTradeRun[]> {
  const { data } = await apiClient.get<PaperTradeRun[]>(
    `${BASE}/${accountStrategyId}/paper-trades`,
  );
  return data;
}

export interface RecentPromotionsQuery {
  strategyCode?: string;
  toState?: PromotionState;
  page?: number;
  size?: number;
}

/**
 * Filterable + paginated cross-strategy promotions feed for the /research
 * dashboard. Backend page-size cap is 100. Empty/blank `strategyCode` and
 * `toState` mean "no filter on that column".
 */
export async function searchRecentPromotions(
  q: RecentPromotionsQuery = {},
): Promise<Page<StrategyPromotionLog>> {
  const params: Record<string, string | number> = {
    page: q.page ?? 0,
    size: q.size ?? 25,
  };
  if (q.strategyCode && q.strategyCode.trim()) params.strategyCode = q.strategyCode.trim();
  if (q.toState) params.toState = q.toState;
  const { data } = await apiClient.get<Page<StrategyPromotionLog>>(`${BASE}/recent/search`, {
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

// ── Account-scoped promotion endpoint ─────────────────────────────────────

/**
 * Account-scope promote/demote. Used by the strategy detail page's mode
 * toggle to flip a single row between PAPER_TRADE and PROMOTED (and other
 * legal transitions). The backend enforces the legal-state graph plus the
 * "active strategy_param preset exists" precondition. Admin-only.
 */
export async function promoteAccountStrategy(
  accountStrategyId: UUID,
  body: PromoteRequest,
): Promise<PromoteResponse> {
  const { data } = await apiClient.post<PromoteResponse>(
    `${BASE}/${accountStrategyId}/promote`,
    body,
  );
  return data;
}

// ── Definition-scoped promotion endpoints ─────────────────────────────────

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

