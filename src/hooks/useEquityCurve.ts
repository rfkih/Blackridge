'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEquityPoints } from '@/lib/api/equity';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useStrategies } from '@/hooks/useStrategies';
import type { EquityPoint } from '@/types/market';

export type EquityPeriod = '7D' | '30D' | '90D' | 'ALL';

const EMPTY_POINTS: EquityPoint[] = [];

const PERIOD_DAYS: Record<EquityPeriod, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  ALL: 365,
};

// Used only as a last-resort fallback when no equity data has loaded yet.
const FALLBACK_CAPITAL = 10_000;

/**
 * Snap the window to hour granularity so query keys are stable across renders
 * and don't mint a new cache entry every millisecond. `Date.now()` in the
 * render body would do exactly that.
 */
function periodWindow(period: EquityPeriod) {
  const now = Date.now();
  const hourMs = 60 * 60 * 1_000;
  const to = Math.floor(now / hourMs) * hourMs;
  const from = to - PERIOD_DAYS[period] * 86_400_000;
  return { from, to };
}

export function useEquityCurve() {
  const [period, setPeriod] = useState<EquityPeriod>('30D');
  // Follow the active-account selection — fall back to the user's first
  // strategy's account only if nothing is explicitly selected (e.g. first
  // login before accounts load).
  const { scopedAccountId } = useActiveAccount();
  const { data: strategies } = useStrategies();
  const accountId = scopedAccountId ?? strategies?.[0]?.accountId;

  // Allocations are percentages, not absolute USDT — summing them produces a
  // meaningless number. Use the first equity sample as the baseline (see
  // `stats.baseline` below); only fall back to a fixed constant until the
  // series loads.
  const allocatedCapital = FALLBACK_CAPITAL;

  const { from, to } = useMemo(() => periodWindow(period), [period]);

  const query = useQuery({
    queryKey: ['equity', accountId, period, from, to],
    queryFn: () => fetchEquityPoints(accountId!, from, to),
    enabled: Boolean(accountId),
    staleTime: 60_000,
    retry: false,
  });

  // `query.data ?? []` would mint a fresh array each render, busting the
  // memoised stats below. Module-level sentinel keeps identity stable.
  const points = query.data ?? EMPTY_POINTS;

  const stats = useMemo(() => {
    if (!points.length) return null;
    const latest = points[points.length - 1]!.equity;
    const first = points[0]!.equity;
    // First equity sample is the actual starting balance for this window.
    const baseline = first || allocatedCapital;
    const change = latest - baseline;
    const changePct = baseline !== 0 ? (change / baseline) * 100 : 0;
    // reduce avoids `Math.min(...largeArr)` which is O(n) AND can hit
    // the JS engine's argument-spread limit on long series.
    const maxDrawdown = points.reduce((m, p) => (p.drawdown < m ? p.drawdown : m), 0);
    return { latest, first, baseline, change, changePct, maxDrawdown };
  }, [points, allocatedCapital]);

  // Prefer the first equity sample (real starting balance) over the allocated fallback.
  const initialCapital = stats?.baseline ?? allocatedCapital;

  return { period, setPeriod, points, stats, isLoading: query.isLoading, initialCapital };
}
