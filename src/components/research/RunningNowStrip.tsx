'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronRight, PauseCircle, PlayCircle } from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';
import { useResearchAutomationStatus } from '@/hooks/useResearchAutomation';
import { useSchedulerStatus } from '@/hooks/useScheduler';
import { useListSweeps } from '@/hooks/useResearch';
import { findResearchTickJob } from '@/lib/research/derivePillState';
import type { SweepState } from '@/types/research';

const ACTIVE_LIMIT = 3;

type Mode = 'paused' | 'running' | 'idle' | 'unknown';

interface RankedSweep {
  sweep: SweepState;
  pct: number;
  startedAtMs: number | null;
}

function rankActive(sweeps: SweepState[] | undefined): RankedSweep[] {
  if (!sweeps) return [];
  return sweeps
    .filter((s) => s.status === 'RUNNING' || s.status === 'PENDING')
    .map((s) => {
      const total = Math.max(s.totalCombos, 1);
      const pct = Math.min(100, Math.round((s.finishedCombos / total) * 100));
      const startedAtMs = s.createdAt ? Date.parse(s.createdAt) : null;
      return { sweep: s, pct, startedAtMs };
    })
    .sort((a, b) => b.pct - a.pct);
}

function findLastCompleted(sweeps: SweepState[] | undefined): SweepState | null {
  if (!sweeps) return null;
  let best: SweepState | null = null;
  let bestMs = -Infinity;
  for (const s of sweeps) {
    if (s.status !== 'COMPLETED') continue;
    const ms = s.completedAt ? Date.parse(s.completedAt) : 0;
    if (Number.isFinite(ms) && ms > bestMs) {
      best = s;
      bestMs = ms;
    }
  }
  return best;
}

export function RunningNowStrip() {
  const { data: automation } = useResearchAutomationStatus();
  const { data: jobs } = useSchedulerStatus();
  const { data: sweeps } = useListSweeps();

  const ranked = useMemo(() => rankActive(sweeps), [sweeps]);
  const visible = ranked.slice(0, ACTIVE_LIMIT);
  const overflow = Math.max(0, ranked.length - ACTIVE_LIMIT);
  const lastCompleted = useMemo(() => findLastCompleted(sweeps), [sweeps]);
  const tick = findResearchTickJob(jobs);
  const nextRunAtMs = tick?.nextRunAt ? Date.parse(tick.nextRunAt) : null;

  const mode: Mode = automation?.paused
    ? 'paused'
    : ranked.length > 0
      ? 'running'
      : sweeps !== undefined && jobs !== undefined && automation !== undefined
        ? 'idle'
        : 'unknown';

  const accent =
    mode === 'running'
      ? 'var(--color-profit)'
      : mode === 'paused'
        ? 'var(--color-warning)'
        : 'var(--border-default)';

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      className="rounded-md border border-bd-subtle bg-bg-surface p-4"
      style={{ borderLeft: `3px solid ${accent}` }}
      aria-label="Research running now"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-text-primary">
          {mode === 'paused' ? (
            <PauseCircle size={14} className="text-[var(--color-warning)]" />
          ) : mode === 'running' ? (
            <Activity size={14} className="text-[var(--color-profit)]" />
          ) : (
            <PlayCircle size={14} className="text-text-muted" />
          )}
          <h2 className="font-display text-[14px] font-semibold tracking-tight">
            {mode === 'running'
              ? `Running now · ${ranked.length} active`
              : mode === 'paused'
                ? 'Research paused'
                : 'No active sweeps'}
          </h2>
        </div>
        <Link
          href="/research/sweeps"
          className="font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] hover:underline"
        >
          All sweeps →
        </Link>
      </div>

      {mode === 'paused' ? (
        <div className="bg-bg-base/40 mt-3 rounded-sm border border-bd-subtle p-3 text-[12px] text-text-secondary">
          Reason: {automation?.reason ?? 'no reason given'}.{' '}
          {automation?.updatedAt && (
            <span className="text-text-muted">
              Paused{' '}
              {formatDistanceStrict(Date.parse(automation.updatedAt), nowMs, {
                addSuffix: true,
              })}
              .
            </span>
          )}{' '}
          Resume from the automation panel below.
        </div>
      ) : mode === 'running' ? (
        <ul className="mt-3 space-y-1.5">
          {visible.map(({ sweep, pct, startedAtMs }) => (
            <li key={sweep.sweepId}>
              <Link
                href={`/research/sweeps/${sweep.sweepId}`}
                className="block rounded-sm border border-bd-subtle bg-bg-elevated px-2.5 py-2 transition-colors hover:bg-bg-hover"
              >
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="truncate font-mono text-text-primary">
                    {sweep.spec.strategyCode} · {sweep.spec.asset} {sweep.spec.interval}
                  </span>
                  <span className="font-mono text-text-muted">
                    {sweep.finishedCombos}/{sweep.totalCombos} · {pct}%
                  </span>
                </div>
                <div className="bg-bg-base/50 mt-1.5 h-1 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full"
                    style={{
                      width: `${pct}%`,
                      background: 'var(--accent-primary)',
                    }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-text-muted">
                  <span className="font-mono uppercase tracking-wider">{sweep.status}</span>
                  <span className="font-mono">
                    {startedAtMs != null
                      ? `started ${formatDistanceStrict(startedAtMs, nowMs)} ago`
                      : '—'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
          {overflow > 0 && (
            <li>
              <Link
                href="/research/sweeps"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--accent-primary)] hover:underline"
              >
                +{overflow} more <ChevronRight size={11} />
              </Link>
            </li>
          )}
        </ul>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-text-secondary">
          {lastCompleted ? (
            <Link
              href={`/research/sweeps/${lastCompleted.sweepId}`}
              className="inline-flex items-center gap-1 font-mono text-text-secondary hover:text-text-primary"
            >
              <span className="text-text-muted">Last completed:</span>
              <span className="text-text-primary">
                {lastCompleted.spec.strategyCode} · {lastCompleted.spec.asset}{' '}
                {lastCompleted.spec.interval}
              </span>
              {lastCompleted.completedAt && (
                <span className="text-text-muted">
                  · {formatDistanceStrict(Date.parse(lastCompleted.completedAt), nowMs)} ago
                </span>
              )}
            </Link>
          ) : (
            <span className="text-text-muted">No sweeps yet.</span>
          )}
          <span className="font-mono text-[11px] text-text-muted">
            {nextRunAtMs != null && nextRunAtMs > nowMs
              ? `Next tick in ${formatDistanceStrict(nowMs, nextRunAtMs)}`
              : tick?.scheduled
                ? 'Next tick due now'
                : tick
                  ? 'Scheduler stopped'
                  : 'Scheduler not registered'}
          </span>
        </div>
      )}
    </section>
  );
}
