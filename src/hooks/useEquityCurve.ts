'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEquityPoints } from '@/lib/api/equity';
import { useStrategies } from '@/hooks/useStrategies';

export type EquityPeriod = '7D' | '30D' | '90D' | 'ALL';

const PERIOD_DAYS: Record<EquityPeriod, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  ALL: 365,
};

// Used only as a last-resort fallback when no equity data has loaded yet.
const FALLBACK_CAPITAL = 10_000;

export function useEquityCurve() {
  const [period, setPeriod] = useState<EquityPeriod>('30D');
  const { data: strategies } = useStrategies();

  const accountId = strategies?.[0]?.accountId;
  // Sum capital across the user's strategies on this account as a better default
  // than a hardcoded number when the equity series hasn't loaded yet.
  const allocatedCapital = useMemo(() => {
    if (!strategies?.length) return FALLBACK_CAPITAL;
    const sum = strategies.reduce((acc, s) => acc + (s.capitalAllocatedUsdt ?? 0), 0);
    return sum > 0 ? sum : FALLBACK_CAPITAL;
  }, [strategies]);

  const days = PERIOD_DAYS[period];
  const to = Date.now();
  const from = to - days * 86_400_000;

  const query = useQuery({
    queryKey: ['equity', accountId, period],
    queryFn: () => fetchEquityPoints(accountId!, from, to),
    enabled: Boolean(accountId),
    staleTime: 60_000,
    retry: false,
  });

  const points = query.data ?? [];

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
