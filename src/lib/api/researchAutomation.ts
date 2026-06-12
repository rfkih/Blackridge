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
  const { data } = await apiClient.post<ResearchAutomationStatus>(
    '/api/v1/admin/research/control/resume',
  );
  return data;
}
