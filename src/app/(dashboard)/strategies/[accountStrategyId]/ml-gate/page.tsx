'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { MlGateTab } from '@/components/strategy/MlGateTab';

interface MinimalStrategy {
  accountStrategyId: string;
  strategyCode: string;
  symbol: string;
  intervalName: string;
  presetName?: string;
}

interface ResponseEnvelope {
  data: MinimalStrategy;
}

async function fetchStrategy(id: string): Promise<MinimalStrategy> {
  // Trading JVM returns ResponseDto-wrapped payloads on this controller;
  // the apiClient interceptor unwraps `.data` so we get the inner row.
  const { data } = await apiClient.get<ResponseEnvelope | MinimalStrategy>(
    `/api/v1/account-strategies/${id}`,
  );
  // The interceptor already unwraps; defensive in case the shape differs.
  return 'data' in data ? (data as ResponseEnvelope).data : (data as MinimalStrategy);
}

export default function StrategyMlGatePage() {
  const params = useParams<{ accountStrategyId: string }>();
  const accountStrategyId = params?.accountStrategyId ?? '';

  const {
    data: strategy,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['strategies', accountStrategyId, 'minimal'] as const,
    queryFn: () => fetchStrategy(accountStrategyId),
    enabled: !!accountStrategyId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !strategy) {
    return (
      <div className="rounded-md border border-loss bg-tint-loss p-4 text-sm text-loss">
        Failed to load strategy.{' '}
        <Link href="/strategies" className="underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/strategies/${strategy.accountStrategyId}`}
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
        >
          <ArrowLeft className="h-3 w-3" /> Strategy detail
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">
          {strategy.strategyCode}
          <span className="ml-2 text-base font-normal text-text-muted">
            {strategy.symbol} · {strategy.intervalName}
          </span>
        </h1>
      </header>

      <MlGateTab
        accountStrategyId={strategy.accountStrategyId}
        strategyCode={strategy.strategyCode}
        symbol={strategy.symbol}
        intervalName={strategy.intervalName}
      />
    </div>
  );
}
