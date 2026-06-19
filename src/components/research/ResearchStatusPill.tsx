'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceStrict } from 'date-fns';
import { useResearchAutomationStatus } from '@/hooks/useResearchAutomation';
import { useSchedulerStatus } from '@/hooks/useScheduler';
import { useListSweeps } from '@/hooks/useResearch';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { derivePillState, type PillState } from '@/lib/research/derivePillState';
import { cn } from '@/lib/utils';

interface PillVisual {
  label: string;
  color: string;
  pulse: boolean;
}

function visualFor(state: PillState, nowMs: number): PillVisual {
  switch (state.kind) {
    case 'paused':
      return { label: 'Paused', color: 'var(--mm-warn)', pulse: true };
    case 'running': {
      const finished = state.finished.toLocaleString();
      const total = state.total.toLocaleString();
      return {
        label: `Running ${finished}/${total}`,
        color: 'var(--mm-up)',
        pulse: true,
      };
    }
    case 'idle': {
      if (state.nextRunAtMs == null) {
        return { label: 'Idle', color: 'var(--mm-info)', pulse: false };
      }
      const dt = state.nextRunAtMs - nowMs;
      if (dt <= 0) {
        return { label: 'Idle · due now', color: 'var(--mm-info)', pulse: false };
      }
      const dur = formatDistanceStrict(nowMs, state.nextRunAtMs);
      return { label: `Idle · ${dur}`, color: 'var(--mm-info)', pulse: false };
    }
    case 'off':
      return { label: 'Off', color: 'var(--mm-warn)', pulse: false };
    case 'unknown':
    default:
      return { label: '', color: 'var(--mm-ink-3)', pulse: false };
  }
}

function tooltipFor(state: PillState, nowMs: number): string {
  const lines: string[] = [];
  switch (state.kind) {
    case 'paused': {
      lines.push('Research automation: PAUSED');
      lines.push(`Reason: ${state.reason ?? 'no reason given'}`);
      if (state.updatedAtMs != null) {
        lines.push(`Paused ${formatDistanceStrict(state.updatedAtMs, nowMs, { addSuffix: true })}`);
      }
      lines.push('Next tick is skipped until resumed.');
      break;
    }
    case 'running': {
      lines.push(`Sweep running: ${state.sweepLabel}`);
      lines.push(`Progress: ${state.finished} / ${state.total} (${state.pct}%)`);
      lines.push('Click to open the research dashboard.');
      break;
    }
    case 'idle': {
      lines.push('Research automation: IDLE');
      if (state.nextRunAtMs != null) {
        lines.push(
          `Next tick: ${new Date(state.nextRunAtMs).toLocaleString()} (${formatDistanceStrict(
            nowMs,
            state.nextRunAtMs,
          )})`,
        );
      } else {
        lines.push('Next tick: unknown — check the cron expression.');
      }
      if (state.cron) lines.push(`Cron: ${state.cron}`);
      if (state.lastRunAtMs != null) {
        lines.push(
          `Last tick: ${formatDistanceStrict(state.lastRunAtMs, nowMs, { addSuffix: true })}`,
        );
      }
      break;
    }
    case 'off': {
      lines.push('Research automation: OFF');
      lines.push(
        state.reason === 'unscheduled'
          ? 'Scheduler stopped — re-enable in the Scheduler panel.'
          : 'No research-tick job registered with the scheduler.',
      );
      if (state.cron) lines.push(`Cron: ${state.cron}`);
      break;
    }
    case 'unknown':
    default:
      break;
  }
  return lines.join('\n');
}

export function ResearchStatusPill() {
  const isAdmin = useIsAdmin();
  const { data: automation } = useResearchAutomationStatus();
  const { data: jobs } = useSchedulerStatus();
  const { data: sweeps } = useListSweeps();

  const state = useMemo(
    () => derivePillState({ automation, jobs, sweeps }),
    [automation, jobs, sweeps],
  );

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (state.kind !== 'idle') return;
    const id = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [state.kind]);

  if (!isAdmin) return null;
  if (state.kind === 'unknown') return null;

  const visual = visualFor(state, nowMs);
  const title = tooltipFor(state, nowMs);

  return (
    <Link
      href="/research"
      className="mm-pill hidden md:inline-flex"
      style={{ padding: '9px 14px', fontSize: 14, textDecoration: 'none' }}
      title={title}
      aria-label={`Research status: ${visual.label}`}
    >
      <span
        aria-hidden="true"
        className={cn('inline-block h-[7px] w-[7px] rounded-full', visual.pulse && 'pulse-dot')}
        style={{ background: visual.color }}
      />
      <span style={{ color: 'var(--mm-ink-1)' }}>{visual.label}</span>
    </Link>
  );
}
