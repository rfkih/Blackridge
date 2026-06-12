'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy } from 'lucide-react';
import { useState } from 'react';
import { useModel } from '@/lib/api/ml';
import { formatDate, parseIsoUtc } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function ModelDetailPage() {
  const params = useParams<{ modelId: string }>();
  const modelId = params?.modelId ?? '';
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useModel(modelId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
        Failed to load model.{' '}
        <Link href="/ml/models" className="underline">
          Back to list
        </Link>
      </div>
    );
  }

  async function copySha() {
    if (!data?.artifactSha256) return;
    try {
      await navigator.clipboard.writeText(data.artifactSha256);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href="/ml/models"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-3 w-3" /> All models
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-100">
            {data.family}/{data.purpose}
          </h1>
          <span className="rounded-full bg-zinc-700/30 px-2 py-0.5 text-xs text-zinc-300">
            v{data.version} · {data.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          {data.symbol ?? '—'} · {data.interval ?? '—'}
          {data.horizonBars != null && data.horizonBars > 0 && ` · ${data.horizonBars} bar horizon`}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard label="Artifact">
          {data.artifactSha256 ? (
            <div className="space-y-1">
              <code className="block break-all font-mono text-xs text-zinc-300">
                {data.artifactSha256}
              </code>
              <button
                type="button"
                onClick={copySha}
                className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy sha256'}
              </button>
              {data.artifactSizeBytes !== null && (
                <p className="mt-1 text-xs text-zinc-500">
                  Size:{' '}
                  <span className="font-mono tabular-nums">
                    {(data.artifactSizeBytes / 1024).toFixed(1)} KB
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No artifact registered.</p>
          )}
        </InfoCard>

        <InfoCard label="Lineage">
          <dl className="space-y-1 text-sm">
            <Row
              k="Created"
              v={data.createdTime ? formatDate(parseIsoUtc(data.createdTime)) : '—'}
            />
            <Row k="Created by" v={data.createdBy ?? '—'} />
          </dl>
        </InfoCard>
      </section>

      {data.metrics && Object.keys(data.metrics).length > 0 && (
        <section className="rounded-md border border-zinc-800 bg-zinc-950/40 p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Metrics
          </h3>
          <pre className="overflow-x-auto rounded bg-zinc-900/60 p-3 text-xs text-zinc-300">
            {JSON.stringify(data.metrics, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

function InfoCard({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-zinc-800 bg-zinc-950/40 p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="font-mono tabular-nums text-zinc-300">{v}</dd>
    </div>
  );
}
