'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSignal } from '@/lib/api/ml';
import { Skeleton } from '@/components/ui/skeleton';
import { SignalKpiCards } from '@/components/ml/SignalKpiCards';
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
      <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
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
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-3 w-3" /> All signals
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-100">{data.signalName}</h1>
          <SignalStatusPill status={data.status} />
          <span className="text-sm text-zinc-500">
            {data.symbol ?? '—'} · {data.intervalName ?? '—'}
          </span>
          <Link
            href={`/ml/models/${data.modelId}`}
            className="text-sm text-zinc-400 hover:text-zinc-200 hover:underline"
          >
            ← {data.modelSpecName}
          </Link>
        </div>
        {data.description && <p className="max-w-3xl text-sm text-zinc-400">{data.description}</p>}
        {data.boundStrategyCodes.length > 0 && (
          <p className="text-xs text-zinc-500">
            Bound to:{' '}
            <span className="font-mono text-zinc-300">{data.boundStrategyCodes.join(', ')}</span>
          </p>
        )}
      </header>

      <SignalKpiCards status={data.status} health={data.health} />

      <SignalTimelineChart signalId={data.signalId} />

      <section>
        <SignalFiringsTable signalId={data.signalId} />
      </section>
    </div>
  );
}
