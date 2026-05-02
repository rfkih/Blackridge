'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldAlert, ShieldCheck, ShieldX, Clock } from 'lucide-react';
import {
  listCrossWindowRuns,
  type CrossWindowRun,
  type CrossWindowVerdict,
} from '@/lib/api/cross-window';
import { formatDate } from '@/lib/formatters';

interface CrossWindowPanelProps {
  strategyCode: string;
  intervalName: string;
  instrument: string;
  /** Compact mode for embedded use inside the promotion dialog. */
  compact?: boolean;
}

interface VerdictMeta {
  label: string;
  Icon: typeof ShieldCheck;
  fg: string;
  bg: string;
  blurb: string;
}

const VERDICT_META: Record<string, VerdictMeta> = {
  ROBUST_CROSS_WINDOW: {
    label: 'Robust',
    Icon: ShieldCheck,
    fg: 'var(--color-profit)',
    bg: 'rgba(0,200,150,0.12)',
    blurb: 'Edge held across regime-stratified windows.',
  },
  INCONSISTENT: {
    label: 'Inconsistent',
    Icon: ShieldAlert,
    fg: 'var(--color-loss)',
    bg: 'rgba(255,77,106,0.12)',
    blurb: 'Edge varies sharply across windows — likely regime-dependent.',
  },
  NO_EDGE: {
    label: 'No edge',
    Icon: ShieldX,
    fg: 'var(--color-loss)',
    bg: 'rgba(255,77,106,0.12)',
    blurb: 'No statistically meaningful edge across windows.',
  },
  INSUFFICIENT_DATA: {
    label: 'Insufficient data',
    Icon: Clock,
    fg: 'var(--color-warning)',
    bg: 'rgba(245,166,35,0.12)',
    blurb: 'Not enough completed windows to validate.',
  },
};

function metaFor(verdict: CrossWindowVerdict): VerdictMeta {
  return (
    VERDICT_META[verdict] ?? {
      label: verdict,
      Icon: ShieldAlert,
      fg: 'var(--text-secondary)',
      bg: 'var(--bg-elevated)',
      blurb: '',
    }
  );
}

export function CrossWindowPanel({
  strategyCode,
  intervalName,
  instrument,
  compact = false,
}: CrossWindowPanelProps) {
  const query = useQuery({
    queryKey: ['cross-window', strategyCode, intervalName, instrument],
    queryFn: () =>
      listCrossWindowRuns({ strategyCode, intervalName, instrument, limit: 5 }),
    staleTime: 60_000,
    retry: 0,
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-bd-subtle bg-bg-surface px-3 py-3 text-text-secondary">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-[12px]">Loading cross-window verdict…</span>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-md border border-bd-subtle bg-bg-surface px-3 py-3 text-[12px] text-text-secondary">
        Cross-window verdict unavailable.
      </div>
    );
  }

  const { latest, runs } = query.data;

  if (!latest) {
    return (
      <div className="rounded-md border border-bd-subtle bg-bg-surface px-3 py-3 text-[12px] text-text-secondary">
        No cross-window run yet for {strategyCode} · {intervalName} · {instrument}.
        <div className="mt-1 text-[11px] text-text-muted">
          Orchestrator will populate this after a SIGNIFICANT_EDGE iteration goes
          through walk-forward + cross-window stratification.
        </div>
      </div>
    );
  }

  const meta = metaFor(latest.crossWindowVerdict);
  const Icon = meta.Icon;

  return (
    <div className="rounded-md border border-bd-subtle bg-bg-surface">
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: meta.bg, color: meta.fg }}
            >
              <Icon size={13} strokeWidth={2} />
              {meta.label}
            </span>
            <span className="font-mono text-[11px] text-text-muted">
              {strategyCode} · {intervalName} · {instrument}
            </span>
          </div>
          <span className="font-mono text-[10px] text-text-muted">
            {latest.createdTime ? formatDate(new Date(latest.createdTime).getTime()) : '—'}
          </span>
        </div>

        {meta.blurb && (
          <div className="text-[12px] text-text-secondary">{meta.blurb}</div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-4">
          <Stat label="Windows" value={`${latest.nWindowsCompleted}/${latest.nWindows}`} />
          <Stat label="PF mean" value={fmtNum(latest.windowPfMean, 2)} />
          <Stat label="PF range" value={`${fmtNum(latest.windowPfMin, 2)} – ${fmtNum(latest.windowPfMax, 2)}`} />
          <Stat label="% net+" value={fmtPct(latest.pctWindowsNetPositive)} />
          {!compact && (
            <>
              <Stat label="Return mean" value={fmtPct(latest.windowReturnMean)} />
              <Stat label="Return σ" value={fmtPct(latest.windowReturnStd)} />
              <Stat label="Trades" value={latest.totalTradesAcrossWindows ?? '—'} />
              <Stat label="Catalog" value={latest.windowsCatalogVersion} mono />
            </>
          )}
        </div>

        {!compact && runs.length > 1 && (
          <div className="border-t border-bd-subtle pt-2">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              History
            </div>
            <div className="flex flex-col gap-1">
              {runs.slice(1).map((r) => (
                <PriorRow key={r.crossWindowId} run={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      <span
        className={mono ? 'font-mono text-[12px] text-text-primary' : 'text-[12px] text-text-primary'}
      >
        {value}
      </span>
    </div>
  );
}

function PriorRow({ run }: { run: CrossWindowRun }) {
  const meta = metaFor(run.crossWindowVerdict);
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
        style={{ backgroundColor: meta.bg, color: meta.fg }}
      >
        {meta.label}
      </span>
      <span className="font-mono text-text-secondary">
        PF {fmtNum(run.windowPfMean, 2)} · {fmtPct(run.pctWindowsNetPositive)} net+
      </span>
      <span className="font-mono text-text-muted">
        {run.createdTime ? formatDate(new Date(run.createdTime).getTime()) : '—'}
      </span>
    </div>
  );
}

function fmtNum(n: number | null | undefined, dp: number): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(dp);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${(Number(n) * 100).toFixed(1)}%`;
}
