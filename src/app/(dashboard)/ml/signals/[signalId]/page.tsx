'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSignal } from '@/lib/api/ml';
import { Skeleton } from '@/components/ui/skeleton';
import { SignalKpiCards } from '@/components/ml/SignalKpiCards';
import { SignalLatestPrediction } from '@/components/ml/SignalLatestPrediction';
import { SignalModelCard } from '@/components/ml/SignalModelCard';
import { SignalStalenessWarning } from '@/components/ml/SignalStalenessWarning';
import { SignalTimelineChart } from '@/components/ml/SignalTimelineChart';
import { SignalFiringsTable } from '@/components/ml/SignalFiringsTable';
import { SignalStatusPill } from '@/components/ml/SignalStatusPill';

export default function SignalDetailPage() {
  const params = useParams<{ signalId: string }>();
  const signalId = params?.signalId;
  const { data, isLoading, isError } = useSignal(signalId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-loss bg-tint-loss p-4 text-sm text-loss">
        Failed to load signal.{' '}
        <Link href="/ml/signals" className="underline">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/ml/signals"
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" /> All signals
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">{data.signalName}</h1>
          <SignalStatusPill status={data.status} />
          <span className="text-sm text-text-muted">
            {data.symbol ?? '—'} · {data.intervalName ?? '—'}
          </span>
          <Link
            href={`/ml/models/${data.modelId}`}
            className="text-sm text-text-secondary hover:text-text-primary hover:underline"
          >
            ← {data.modelSpecName}
          </Link>
        </div>
        {data.description && <p className="max-w-3xl text-sm text-text-secondary">{data.description}</p>}
        {data.boundStrategyCodes.length > 0 && (
          <p className="text-xs text-text-muted">
            Bound to:{' '}
            <span className="font-mono text-text-secondary">{data.boundStrategyCodes.join(', ')}</span>
          </p>
        )}
      </header>

      <SignalStalenessWarning health={data.health} />
      <SignalLatestPrediction signalId={data.signalId} objective={data.model?.objective} />
      <SignalKpiCards status={data.status} health={data.health} />

      <SignalTimelineChart signalId={data.signalId} />

      {data.model && <SignalModelCard model={data.model} />}

      <section>
        <SignalFiringsTable signalId={data.signalId} />
      </section>
    </div>
  );
}
