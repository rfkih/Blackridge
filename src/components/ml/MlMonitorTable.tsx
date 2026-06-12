'use client';

import Link from 'next/link';
import { useMlMonitor } from '@/lib/api/ml';
import { formatRelativeTime } from '@/lib/formatters';
import type { HealthVerdict } from '@/types/ml';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { HealthDot } from './HealthDot';
import { SignalStatusPill } from './SignalStatusPill';
import { CoverageBar } from './CoverageBar';
import { MlMonitorAlertRibbon } from './MlMonitorAlertRibbon';

function fmtAuc(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return v.toFixed(3);
}

function fmtRatio(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

export function MlMonitorTable() {
  const { data, isLoading, isError, refetch } = useMlMonitor();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
        Failed to load /ml/monitor.{' '}
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Page copy promises "red rows alert at the top" — the rollup is the full
  // (non-paginated) dataset, so display ordering happens here.
  const HEALTH_RANK: Record<HealthVerdict, number> = { red: 0, amber: 1, green: 2 };
  const rows = [...(data?.rows ?? [])].sort(
    (a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health],
  );
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
        No active or shadow signals registered yet. Train and register a model to see it here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MlMonitorAlertRibbon rows={rows} />
      <div className="overflow-x-auto rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Signal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Symbol / Iv</TableHead>
              <TableHead>Strategies</TableHead>
              <TableHead className="text-right">Coverage 7d</TableHead>
              <TableHead className="text-right">AUC</TableHead>
              <TableHead className="text-right">Fires 24h</TableHead>
              <TableHead className="text-right">Last fire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.signalId} className="hover:bg-zinc-900/40">
                <TableCell>
                  <HealthDot health={r.health} reason={r.healthReason} />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/ml/signals/${r.signalId}`}
                    className="font-medium text-zinc-100 hover:underline"
                  >
                    {r.signalName}
                  </Link>
                  <p className="text-xs text-zinc-500">{r.modelSpecName}</p>
                </TableCell>
                <TableCell>
                  <SignalStatusPill status={r.status} />
                </TableCell>
                <TableCell className="text-sm text-zinc-300">
                  {r.symbol ?? '—'} <span className="text-zinc-500">·</span> {r.intervalName ?? '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {r.boundStrategyCodes.length === 0 ? (
                    <span className="text-zinc-500">—</span>
                  ) : (
                    <span className="font-mono text-zinc-300">
                      {r.boundStrategyCodes.join(', ')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <CoverageBar ratio={r.coverage7dRatio} />
                    <span className="font-mono text-xs tabular-nums text-zinc-400">
                      {fmtRatio(r.coverage7dRatio)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtAuc(r.walkforwardAuc)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.fires24h}</TableCell>
                <TableCell className="text-right text-xs text-zinc-400">
                  <div title="Latest signal bar (data recency)">
                    {formatRelativeTime(r.lastFireTs)}
                  </div>
                  {r.lastProducedAt && (
                    <div
                      className="text-[10px] text-zinc-600"
                      title="When the inference worker last wrote this signal (pipeline liveness)"
                    >
                      written {formatRelativeTime(r.lastProducedAt)}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
