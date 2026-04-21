'use client';

import { useMutation } from '@tanstack/react-query';
import { runMonteCarlo } from '@/lib/api/montecarlo';
import type { MonteCarloSubmitPayload } from '@/types/montecarlo';

/**
 * Monte Carlo runs are fire-and-forget — we never cache the result because a
 * second run with the same params is deliberately *different* (randomSeed).
 * Expose as a mutation so the form can pick up isPending / error state
 * directly.
 */
export function useMonteCarlo() {
  return useMutation({
    mutationFn: (payload: MonteCarloSubmitPayload) => runMonteCarlo(payload),
  });
}
