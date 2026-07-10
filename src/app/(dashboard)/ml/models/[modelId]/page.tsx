'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { formatDate, parseIsoUtc } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MlModel } from '@/types/ml';

interface ModelSnake {
  id: string;
  family: string;
  purpose: string;
  symbol: string | null;
  interval: string | null;
  horizon_bars: number | null;
  status: string;
  version: number;
  artifact_sha256: string | null;
  artifact_size_bytes: number | null;
  created_time: string;
  created_by: string | null;
  metrics: Record<string, unknown> | null;
}

async function fetchModel(id: string): Promise<MlModel> {
  // The orchestrator's /models/{id} ships raw asyncpg snake_case keys;
  // normalize at the boundary so the UI consumes camelCase consistently
  // (matches the mapping in lib/api/ml.ts:fetchModels).
  const { data } = await apiClient.get<ModelSnake>(`/api/v1/research-orch/models/${id}`);
  return {
    id: data.id,
    family: data.family,
    purpose: data.purpose,
    symbol: data.symbol,
    interval: data.interval,
    horizonBars: data.horizon_bars,
    status: data.status as MlModel['status'],
    version: data.version,
    artifactSha256: data.artifact_sha256,
    artifactSizeBytes: data.artifact_size_bytes,
    createdTime: data.created_time,
    createdBy: data.created_by,
    metrics: data.metrics,
  };
}

export default function ModelDetailPage() {
  const params = useParams<{ modelId: string }>();
  const modelId = params?.modelId ?? '';
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ml', 'model', modelId] as const,
    queryFn: () => fetchModel(modelId),
    enabled: !!modelId,
    staleTime: 60_000,
  });

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
      <div className="rounded-md border border-loss bg-tint-loss p-4 text-sm text-loss">
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
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <ArrowLeft className="h-3 w-3" /> All models
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary">
            {data.family}/{data.purpose}
          </h1>
          <span className="rounded-full bg-bd px-2 py-0.5 text-xs text-text-secondary">
            v{data.version} · {data.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-xs text-text-muted">
          {data.symbol ?? '—'} · {data.interval ?? '—'}
          {data.horizonBars && ` · ${data.horizonBars} bar horizon`}
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoCard label="Artifact">
          {data.artifactSha256 ? (
            <div className="space-y-1">
              <code className="block break-all font-mono text-xs text-text-secondary">
                {data.artifactSha256}
              </code>
              <button
                type="button"
                onClick={copySha}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
              >
                <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy sha256'}
              </button>
              {data.artifactSizeBytes !== null && (
                <p className="mt-1 text-xs text-text-muted">
                  Size:{' '}
                  <span className="font-mono tabular-nums">
                    {(data.artifactSizeBytes / 1024).toFixed(1)} KB
                  </span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-muted">No artifact registered.</p>
          )}
        </InfoCard>

        <InfoCard label="Lineage">
          <dl className="space-y-1 text-sm">
            <Row
              k="Created"
              v={
                // parseIsoUtc: the zone-less orchestrator timestamp is UTC; a
                // bare new Date().toISOString() double-shifted it by the
                // browser's UTC offset.
                data.createdTime ? formatDate(parseIsoUtc(data.createdTime)) : '—'
              }
            />
            <Row k="Created by" v={data.createdBy ?? '—'} />
          </dl>
        </InfoCard>
      </section>

      {data.metrics && Object.keys(data.metrics).length > 0 && (
        <section className="rounded-md border border-bd-subtle bg-bg-elevated p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
            Metrics
          </h3>
          <pre className="overflow-x-auto rounded bg-bg-hover p-3 text-xs text-text-secondary">
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
    <div className={cn('rounded-md border border-bd-subtle bg-bg-elevated p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-muted">{k}</dt>
      <dd className="font-mono tabular-nums text-text-secondary">{v}</dd>
    </div>
  );
}
