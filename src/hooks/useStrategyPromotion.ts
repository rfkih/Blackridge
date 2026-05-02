'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCurrentState,
  getDefinitionHistory,
  getDefinitionState,
  getPaperTrades,
  getPromotionHistory,
  getRecentPromotions,
  promote,
  promoteDefinition,
  searchRecentPromotions,
  type PromoteRequest,
  type RecentPromotionsQuery,
} from '@/lib/api/strategy-promotion';

const RECENT_KEY = ['strategy-promotion', 'recent'] as const;

export function useRecentPromotions(limit = 50) {
  return useQuery({
    queryKey: [...RECENT_KEY, limit],
    queryFn: () => getRecentPromotions(limit),
    // The dashboard panel polls; refetch on a 30s cadence and keep prior
    // data visible while the next fetch runs to avoid the panel flickering
    // empty between ticks.
    refetchInterval: 30_000,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

/**
 * Filterable + paginated recent promotions. Returns a Page envelope from the
 * backend so callers can render pagination controls. The query key includes
 * every filter parameter so changing a filter forms a new cache entry.
 */
export function useSearchRecentPromotions(q: RecentPromotionsQuery) {
  return useQuery({
    queryKey: [
      ...RECENT_KEY,
      'search',
      q.strategyCode ?? '',
      q.toState ?? '',
      q.page ?? 0,
      q.size ?? 25,
    ],
    queryFn: () => searchRecentPromotions(q),
    refetchInterval: 30_000,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
}

export function usePromotionState(accountStrategyId: string | undefined) {
  return useQuery({
    queryKey: ['strategy-promotion', 'state', accountStrategyId],
    queryFn: () => getCurrentState(accountStrategyId as string),
    enabled: Boolean(accountStrategyId),
    staleTime: 15_000,
  });
}

export function usePromotionHistory(accountStrategyId: string | undefined) {
  return useQuery({
    queryKey: ['strategy-promotion', 'history', accountStrategyId],
    queryFn: () => getPromotionHistory(accountStrategyId as string),
    enabled: Boolean(accountStrategyId),
    staleTime: 30_000,
  });
}

export function usePaperTrades(accountStrategyId: string | undefined) {
  return useQuery({
    queryKey: ['strategy-promotion', 'paper-trades', accountStrategyId],
    queryFn: () => getPaperTrades(accountStrategyId as string),
    enabled: Boolean(accountStrategyId),
    staleTime: 15_000,
  });
}

/**
 * Promote / demote / reject mutation. After a successful flip we invalidate
 * the cross-strategy "recent" feed AND the per-strategy state/history so
 * the dashboard's candidate row reshuffles to the right bucket without
 * needing a manual refresh.
 */
export function useStrategyPromote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountStrategyId, ...body }: PromoteRequest & { accountStrategyId: string }) =>
      promote(accountStrategyId, body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: RECENT_KEY });
      queryClient.invalidateQueries({
        queryKey: ['strategy-promotion', 'state', vars.accountStrategyId],
      });
      queryClient.invalidateQueries({
        queryKey: ['strategy-promotion', 'history', vars.accountStrategyId],
      });
      // The promote endpoint flips account_strategy.simulated/.enabled
      // server-side, so the strategies list needs a refresh to reshuffle
      // bucket membership in the candidates panel.
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
  });
}

// ── definition-scope (V40) ────────────────────────────────────────────────

export function useDefinitionPromotionState(strategyCode: string | undefined) {
  return useQuery({
    queryKey: ['strategy-promotion', 'definition', 'state', strategyCode],
    queryFn: () => getDefinitionState(strategyCode as string),
    enabled: Boolean(strategyCode),
    staleTime: 15_000,
  });
}

export function useDefinitionPromotionHistory(strategyCode: string | undefined) {
  return useQuery({
    queryKey: ['strategy-promotion', 'definition', 'history', strategyCode],
    queryFn: () => getDefinitionHistory(strategyCode as string),
    enabled: Boolean(strategyCode),
    staleTime: 30_000,
  });
}

/**
 * Definition-scope promote/demote/reject. Invalidates the strategy-definitions
 * list so the panel reshuffles, plus the cross-strategy recent feed and the
 * per-code state/history queries.
 */
export function useDefinitionPromote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ strategyCode, ...body }: PromoteRequest & { strategyCode: string }) =>
      promoteDefinition(strategyCode, body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: RECENT_KEY });
      queryClient.invalidateQueries({
        queryKey: ['strategy-promotion', 'definition', 'state', vars.strategyCode],
      });
      queryClient.invalidateQueries({
        queryKey: ['strategy-promotion', 'definition', 'history', vars.strategyCode],
      });
      queryClient.invalidateQueries({ queryKey: ['strategy-definitions'] });
    },
  });
}
