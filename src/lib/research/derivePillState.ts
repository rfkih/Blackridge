import type { ResearchAutomationStatus } from '@/lib/api/researchAutomation';
import type { SchedulerJobStatus } from '@/lib/api/scheduler';
import type { SweepState } from '@/types/research';

export type PillState =
  | { kind: 'paused'; reason: string | null; updatedAtMs: number | null }
  | {
      kind: 'running';
      sweepId: string;
      sweepLabel: string;
      finished: number;
      total: number;
      pct: number;
    }
  | {
      kind: 'idle';
      nextRunAtMs: number | null;
      cron: string | null;
      lastRunAtMs: number | null;
    }
  | { kind: 'off'; reason: 'no-job' | 'unscheduled'; cron: string | null }
  | { kind: 'unknown' };

const RESEARCH_TICK_RE = /research[_-]?tick/i;

function parseIso(s: string | null | undefined): number | null {
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

export function findResearchTickJob(
  jobs: SchedulerJobStatus[] | undefined,
): SchedulerJobStatus | undefined {
  if (!jobs) return undefined;
  return jobs.find((j) => RESEARCH_TICK_RE.test(j.jobName) || RESEARCH_TICK_RE.test(j.jobType));
}

export function derivePillState(input: {
  automation: ResearchAutomationStatus | undefined;
  jobs: SchedulerJobStatus[] | undefined;
  sweeps: SweepState[] | undefined;
}): PillState {
  const { automation, jobs, sweeps } = input;

  if (automation === undefined && jobs === undefined && sweeps === undefined) {
    return { kind: 'unknown' };
  }

  if (automation?.paused) {
    return {
      kind: 'paused',
      reason: automation.reason ?? null,
      updatedAtMs: parseIso(automation.updatedAt),
    };
  }

  if (sweeps && sweeps.length > 0) {
    const running = sweeps
      .filter((s) => s.status === 'RUNNING')
      .map((s) => {
        const total = Math.max(s.totalCombos, 1);
        const pct = Math.min(100, Math.round((s.finishedCombos / total) * 100));
        return { sweep: s, ratio: s.finishedCombos / total, pct };
      })
      .sort((a, b) => b.ratio - a.ratio);

    const top = running[0];
    if (top) {
      return {
        kind: 'running',
        sweepId: top.sweep.sweepId,
        sweepLabel: `${top.sweep.spec.strategyCode} · ${top.sweep.spec.asset} ${top.sweep.spec.interval}`,
        finished: top.sweep.finishedCombos,
        total: top.sweep.totalCombos,
        pct: top.pct,
      };
    }
  }

  const tick = findResearchTickJob(jobs);

  if (tick && tick.scheduled) {
    return {
      kind: 'idle',
      nextRunAtMs: parseIso(tick.nextRunAt),
      cron: tick.cronExpression || null,
      lastRunAtMs: parseIso(tick.lastRunAt),
    };
  }

  if (tick && !tick.scheduled) {
    return {
      kind: 'off',
      reason: 'unscheduled',
      cron: tick.cronExpression || null,
    };
  }

  if (jobs !== undefined) {
    return { kind: 'off', reason: 'no-job', cron: null };
  }

  return { kind: 'unknown' };
}
