// Frontend client for /api/v1/scheduler. Admin-only on the backend; the
// /research dashboard polls list() to render the Scheduler panel.
//
// Lives on the trading JVM (the research JVM has @Profile("!research") on
// SchedulerController) so we use apiClient — never researchClient.
import { apiClient } from './client';
import type { ISO8601 } from '@/types/api';

export interface SchedulerJobStatus {
  id: number;
  jobName: string;
  jobType: string;
  cronExpression: string;
  /** "1" enabled, "0" disabled (legacy column convention). */
  status: string;
  /** True iff the in-process schedulerMap has an active future for this job. */
  scheduled: boolean;
  /** Next fire time computed from cron; null when expression is malformed. */
  nextRunAt: ISO8601 | null;
  /** Last observed run; only IP_MONITOR persists a heartbeat today. */
  lastRunAt: ISO8601 | null;
}

export async function listSchedulers(): Promise<SchedulerJobStatus[]> {
  const { data } = await apiClient.get<SchedulerJobStatus[]>('/api/v1/scheduler');
  return data;
}

export interface SchedulerUpdateInput {
  /** Spring 6-field cron (sec min hr day mon dow). Omit to leave unchanged. */
  cronExpression?: string;
  /** "1" = enabled (rescheduled), "0" = disabled (stopped). Omit to leave unchanged. */
  status?: '0' | '1';
}

/**
 * Partial update of a scheduler job. Server validates the cron expression
 * before persisting, so a malformed expression returns 400 with the
 * underlying CronTrigger error message — surface that inline to the
 * operator instead of treating it as a generic failure.
 */
export async function updateScheduler(
  id: number,
  patch: SchedulerUpdateInput,
): Promise<SchedulerJobStatus> {
  const { data } = await apiClient.patch<SchedulerJobStatus>(
    `/api/v1/scheduler/${id}`,
    patch,
  );
  return data;
}

/**
 * Trigger a scheduler job immediately. Returns once the job has been
 * queued onto the server's TaskScheduler pool — the actual run happens
 * asynchronously, so this resolving doesn't mean the work is done.
 */
export async function runSchedulerOnce(id: number): Promise<void> {
  await apiClient.post(`/api/v1/scheduler/${id}/run`);
}
