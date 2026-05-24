import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MlMonitorRow } from '@/types/ml';
import { HealthDot } from './HealthDot';
import { SignalStatusPill } from './SignalStatusPill';
import { CoverageBar } from './CoverageBar';

function fmtRelative(ts: string | null): string {
  if (!ts) return '—';
  try {
    return `${formatDistanceToNowStrict(new Date(ts))} ago`;
  } catch {
    return '—';
  }
}

function fmtAuc(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return v.toFixed(3);
}

/**
 * One row inside the dashboard ML health strip. Renders as a single-line
 * link with at-a-glance KPIs and a chevron — full drill-down lives at
 * `/ml/signals/[signalId]`.
 *
 * Accessibility: the row reports its health in `aria-label` so screen
 * readers don't have to parse the dot colour out of the visual.
 */
export function MlHealthStripRow({ row }: { row: MlMonitorRow }) {
  const aria = `${row.signalName}, health ${row.health}${
    row.healthReason ? `: ${row.healthReason}` : ''
  }`;
  return (
    <Link
      href={`/ml/signals/${row.signalId}`}
      aria-label={aria}
      className={cn(
        'group flex items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm',
        'transition hover:border-zinc-700 hover:bg-zinc-900/60',
      )}
    >
      <HealthDot health={row.health} reason={row.healthReason} />
      <span className="font-medium text-zinc-100">{row.signalName}</span>
      <SignalStatusPill status={row.status} />
      <span className="text-xs text-zinc-500">
        {row.symbol ?? '—'} · {row.intervalName ?? '—'}
      </span>
      {row.boundStrategyCodes.length > 0 && (
        <span className="text-xs text-zinc-400">
          → <span className="font-mono">{row.boundStrategyCodes.join(', ')}</span>
        </span>
      )}
      <div className="ml-auto flex items-center gap-5 text-xs">
        <span className="font-mono tabular-nums text-zinc-400">
          AUC <span className="text-zinc-200">{fmtAuc(row.walkforwardAuc)}</span>
        </span>
        <span className="font-mono tabular-nums text-zinc-400">
          24h <span className="text-zinc-200">{row.fires24h}</span>
        </span>
        <span className="hidden font-mono tabular-nums text-zinc-400 md:inline">
          {fmtRelative(row.lastFireTs)}
        </span>
        <CoverageBar ratio={row.coverage7dRatio} />
        <ChevronRight aria-hidden className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400" />
      </div>
    </Link>
  );
}
