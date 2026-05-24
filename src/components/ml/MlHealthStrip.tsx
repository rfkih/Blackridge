'use client';

import Link from 'next/link';
import { Activity, AlertTriangle } from 'lucide-react';
import { useMlMonitor } from '@/lib/api/ml';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MlHealthStripRow } from './MlHealthStripRow';

const HEALTH_RANK: Record<string, number> = { red: 0, amber: 1, green: 2 };
const MAX_VISIBLE = 5;

/**
 * Dashboard ML health strip. Renders ~80px of vertical real estate
 * between the equity-curve widget and the positions table.
 *
 * Hits `GET /ml/monitor` via the orchestrator proxy. Refetches every 30s
 * and on window focus — at-a-glance is the primary use case. Errors do
 * NOT block the rest of the dashboard; they collapse the strip to a
 * single retry pill.
 */
export function MlHealthStrip({ className }: { className?: string }) {
  const { data, isLoading, isError, refetch } = useMlMonitor();

  if (isLoading) {
    return (
      <section className={cn('space-y-2', className)} aria-busy>
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <Activity className="h-3.5 w-3.5" /> ML signals
        </h2>
        <Skeleton className="h-12 w-full rounded-md" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className={cn('space-y-2', className)}>
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <Activity className="h-3.5 w-3.5" /> ML signals
        </h2>
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="flex w-full items-center justify-between rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            ML monitor unreachable
          </span>
          <span className="text-xs text-rose-200/80">retry</span>
        </button>
      </section>
    );
  }

  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <section className={cn('space-y-2', className)}>
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <Activity className="h-3.5 w-3.5" /> ML signals
        </h2>
        <div className="rounded-md border border-dashed border-zinc-800 px-3 py-2 text-sm text-zinc-500">
          No ML signals wired to any live gate yet.{' '}
          <Link href="/ml/monitor" className="text-zinc-400 underline hover:text-zinc-200">
            Open ML monitor →
          </Link>
        </div>
      </section>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const ra = HEALTH_RANK[a.health] ?? 3;
    const rb = HEALTH_RANK[b.health] ?? 3;
    if (ra !== rb) return ra - rb;
    return b.fires24h - a.fires24h;
  });
  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - visible.length;

  return (
    <section className={cn('space-y-2', className)} aria-label="ML signal health">
      <h2 className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-zinc-500">
        <span className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" /> ML signals
        </span>
        <Link
          href="/ml/monitor"
          className="font-normal normal-case text-zinc-500 hover:text-zinc-300"
        >
          View all →
        </Link>
      </h2>
      <div className="space-y-1.5">
        {visible.map((row) => (
          <MlHealthStripRow key={row.signalId} row={row} />
        ))}
        {overflow > 0 && (
          <Link
            href="/ml/monitor"
            className="block rounded-md border border-zinc-800 px-3 py-1.5 text-center text-xs text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300"
          >
            + {overflow} more
          </Link>
        )}
      </div>
    </section>
  );
}
