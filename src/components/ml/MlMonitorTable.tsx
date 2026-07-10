'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { useMlMonitor } from '@/lib/api/ml';
import { parseIsoUtc } from '@/lib/formatters';
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

function fmtRelative(ts: string | null): string {
  if (!ts) return '—';
  try {
    // parseIsoUtc: orchestrator timestamps arrive zone-less but ARE UTC —
    // local-parsing inflated recency by the browser's UTC offset, making a
    // live pipeline read as stale.
    return `${formatDistanceToNowStrict(parseIsoUtc(ts))} ago`;
  } catch {
    return '—';
  }
}

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
      <div className="rounded-md border border-loss bg-tint-loss px-4 py-3 text-sm text-loss">
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

  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-bd-subtle px-4 py-8 text-center text-sm text-text-muted">
        No active or shadow signals registered yet. Train and register a model to see it here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MlMonitorAlertRibbon rows={rows} />
      <div className="overflow-x-auto rounded-md border border-bd-subtle">
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
              <TableRow key={r.signalId} className="hover:bg-bg-hover">
                <TableCell>
                  <HealthDot health={r.health} reason={r.healthReason} />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/ml/signals/${r.signalId}`}
                    className="font-medium text-text-primary hover:underline"
                  >
                    {r.signalName}
                  </Link>
                  <p className="text-xs text-text-muted">{r.modelSpecName}</p>
                </TableCell>
                <TableCell>
                  <SignalStatusPill status={r.status} />
                </TableCell>
                <TableCell className="text-sm text-text-secondary">
                  {r.symbol ?? '—'} <span className="text-text-muted">·</span> {r.intervalName ?? '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {r.boundStrategyCodes.length === 0 ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <span className="font-mono text-text-secondary">
                      {r.boundStrategyCodes.join(', ')}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <CoverageBar ratio={r.coverage7dRatio} />
                    <span className="font-mono text-xs tabular-nums text-text-secondary">
                      {fmtRatio(r.coverage7dRatio)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {fmtAuc(r.walkforwardAuc)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.fires24h}</TableCell>
                <TableCell className="text-right text-xs text-text-secondary">
                  <div title="Latest signal bar (data recency)">{fmtRelative(r.lastFireTs)}</div>
                  {r.lastProducedAt && (
                    <div
                      className="text-[12px] text-text-muted"
                      title="When the inference worker last wrote this signal (pipeline liveness)"
                    >
                      written {fmtRelative(r.lastProducedAt)}
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
