'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEquityPoints } from '@/lib/api/equity';
import { useAuthStore } from '@/store/authStore';
import { useStrategies } from '@/hooks/useStrategies';

export type EquityPeriod = '7D' | '30D' | '90D' | 'ALL';

const PERIOD_DAYS: Record<EquityPeriod, number> = {
  '7D': 7,
  '30D': 30,
  '90D': 90,
  ALL: 365,
};

const INITIAL_CAPITAL = 10_000;

export function useEquityCurve() {
  const [period, setPeriod] = useState<EquityPeriod>('30D');
  const { data: strategies } = useStrategies();
  const userId = useAuthStore((s) => s.user?.id);

  const accountId = strategies?.[0]?.accountId;

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
    const latest = points[points.length - 1]?.equity ?? INITIAL_CAPITAL;
    const first = points[0]?.equity ?? INITIAL_CAPITAL;
    const change = latest - INITIAL_CAPITAL;
    const changePct = (change / INITIAL_CAPITAL) * 100;
    const maxDrawdown = Math.min(0, ...points.map((p) => p.drawdown));
    return { latest, first, change, changePct, maxDrawdown };
  }, [points]);

  return { period, setPeriod, points, stats, isLoading: query.isLoading, initialCapital: INITIAL_CAPITAL };
}
