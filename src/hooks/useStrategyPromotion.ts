'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDefinitionState,
  promoteAccountStrategy,
  promoteDefinition,
  searchRecentPromotions,
  type PromoteRequest,
  type RecentPromotionsQuery,
} from '@/lib/api/strategy-promotion';

const RECENT_KEY = ['strategy-promotion', 'recent'] as const;

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

// ── account-scope (V15) ───────────────────────────────────────────────────

/**
 * Account-scope promote/demote — used by the strategy detail page's mode
 * toggle (PAPER ↔ LIVE). Invalidates the strategies list + the per-strategy
 * detail query + the cross-strategy recent promotions feed so every surface
 * picks up the new simulated/enabled state.
 */
export function useAccountStrategyPromote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountStrategyId, ...body }: PromoteRequest & { accountStrategyId: string }) =>
      promoteAccountStrategy(accountStrategyId, body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: RECENT_KEY });
      queryClient.invalidateQueries({ queryKey: ['strategies'] });
      queryClient.invalidateQueries({ queryKey: ['strategy', vars.accountStrategyId] });
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
