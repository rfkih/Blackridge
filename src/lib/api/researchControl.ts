
import { apiClient } from './client';
import type { ISO8601 } from '@/types/api';

export type ResearchLaunchState =
  | 'STARTED'
  | 'ALREADY_RUNNING'
  | 'STARTING'
  | 'STOPPED'
  | 'STOP_REQUESTED'
  | 'STOP_FAILED'
  | 'ALREADY_DOWN'
  | 'RESTARTED';

export interface ResearchLaunchResult {
  state: ResearchLaunchState;
  healthy: boolean;
  pid: number | null;
  logPath: string | null;
  message: string;
  observedAt: ISO8601;
}

export async function startResearch(): Promise<ResearchLaunchResult> {
  const { data } = await apiClient.post<ResearchLaunchResult>('/api/v1/admin/research/start');
  return data;
}

export async function stopResearch(): Promise<ResearchLaunchResult> {
  const { data } = await apiClient.post<ResearchLaunchResult>('/api/v1/admin/research/stop');
  return data;
}

export async function restartResearch(): Promise<ResearchLaunchResult> {
  const { data } = await apiClient.post<ResearchLaunchResult>('/api/v1/admin/research/restart');
  return data;
}
