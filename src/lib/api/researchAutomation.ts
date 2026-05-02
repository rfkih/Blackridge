// Frontend client for /api/v1/admin/research/control — pause/resume the
// autonomous research-tick loop. Lives on the trading JVM (admin namespace)
// so apiClient is correct; OS cron reads the flag from the DB so neither
// JVM needs to be up for a pause to take effect on the next tick.
import { apiClient } from './client';
import type { ISO8601 } from '@/types/api';

export interface ResearchAutomationStatus {
  paused: boolean;
  reason: string | null;
  updatedAt: ISO8601;
  updatedByUserId: string | null;
}

export async function getResearchAutomationStatus(): Promise<ResearchAutomationStatus> {
  const { data } = await apiClient.get<ResearchAutomationStatus>('/api/v1/admin/research/control');
  return data;
}

export async function pauseResearchAutomation(reason?: string): Promise<ResearchAutomationStatus> {
  const { data } = await apiClient.post<ResearchAutomationStatus>(
    '/api/v1/admin/research/control/pause',
    reason ? { reason } : {},
  );
  return data;
}

export async function resumeResearchAutomation(): Promise<ResearchAutomationStatus> {
  const { data } = await apiClient.post<ResearchAutomationStatus>('/api/v1/admin/research/control/resume');
  return data;
}
