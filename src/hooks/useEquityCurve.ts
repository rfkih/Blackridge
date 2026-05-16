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

  const { scopedAccountId } = useActiveAccount();
  const { data: strategies } = useStrategies();
  const accountId = scopedAccountId ?? strategies?.[0]?.accountId;

  const allocatedCapital = FALLBACK_CAPITAL;

  const { from, to } = useMemo(() => periodWindow(period), [period]);

  const query = useQuery({
    queryKey: ['equity', accountId, period, from, to],
    queryFn: () => fetchEquityPoints(accountId!, from, to),
    enabled: Boolean(accountId),
    staleTime: 60_000,
    retry: false,
  });

  const points = query.data ?? EMPTY_POINTS;

  const stats = useMemo(() => {
    if (!points.length) return null;
    const latest = points[points.length - 1]!.equity;
    const first = points[0]!.equity;

    const baseline = first || allocatedCapital;
    const change = latest - baseline;
    const changePct = baseline !== 0 ? (change / baseline) * 100 : 0;

    const maxDrawdown = points.reduce((m, p) => (p.drawdown < m ? p.drawdown : m), 0);
    return { latest, first, baseline, change, changePct, maxDrawdown };
  }, [points, allocatedCapital]);

  const initialCapital = stats?.baseline ?? allocatedCapital;

  return { period, setPeriod, points, stats, isLoading: query.isLoading, initialCapital };
}
