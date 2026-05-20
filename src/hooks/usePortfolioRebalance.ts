'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPortfolioWeights, rebalancePortfolio } from '@/lib/api/portfolioRebalance';
import { generateIdempotencyKey } from '@/lib/idempotency';
import { QUERY_STALE_TIMES } from '@/lib/constants';
import type { RebalanceRequest } from '@/types/portfolioRebalance';

const WEIGHTS_KEY = (accountId: string | undefined) =>
  ['portfolio', 'weights', accountId ?? 'all'] as const;

/**
 * Current portfolio_weight per live AccountStrategy row, scoped by
 * {@code accountId}. Pass {@code undefined} for the admin "all
 * accounts" view; pass a UUID for the per-user view. Same staleTime as
 * the portfolio page so the two views agree.
 */
export function usePortfolioWeights(accountId?: string) {
  return useQuery({
    queryKey: WEIGHTS_KEY(accountId),
    queryFn: () => listPortfolioWeights(accountId),
    staleTime: QUERY_STALE_TIMES.portfolio,
  });
}

/**
 * Rebalance mutation. The request must include {@code account_id} --
 * each user owns their AccountStrategy rows and a rebalance is always
 * per-account. Pass {@code dry_run: true} for a preview -- orchestrator
 * returns proposed weights without UPDATE-ing live rows (still writes
 * a {@code [DRY-RUN]} journal entry for audit).
 *
 * <p>Idempotency-Key is generated per call so the orchestrator dedupes
 * accidental double-clicks. On a real apply we invalidate the weights
 * query for the affected account so its table re-fetches; dry-run
 * results are NOT invalidated -- the cached state is still correct.
 */
export function useRebalancePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: RebalanceRequest) =>
      rebalancePortfolio(request, generateIdempotencyKey('rebalance')),
    onSuccess: (response, request) => {
      if (response.applied) {
        queryClient.invalidateQueries({ queryKey: WEIGHTS_KEY(request.account_id) });
        // Also invalidate the admin "all accounts" view so it reflects the change.
        queryClient.invalidateQueries({ queryKey: WEIGHTS_KEY(undefined) });
      }
    },
  });
}
