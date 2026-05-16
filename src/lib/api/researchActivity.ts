/**
 * API module for quant-researcher agent activity endpoints.
 * All calls target the Research JVM (:8081) via `researchClient`.
 */
import { researchClient } from '@/lib/api/client';
import type { AgentActivity, AgentSessionSummary } from '@/types/research';

export interface SessionsResponse {
  content: AgentSessionSummary[];
  page: number;
  size: number;
  total: number;
}

export interface ActivitiesResponse {
  content: AgentActivity[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const researchActivityApi = {
  getSessions: (page = 0, size = 20): Promise<SessionsResponse> =>
    researchClient
      .get<SessionsResponse>('/api/v1/research/activity/sessions', { params: { page, size } })
      .then((r) => r.data),

  getActivities: (sessionId: string, page = 0, size = 100): Promise<ActivitiesResponse> =>
    researchClient
      .get<ActivitiesResponse>('/api/v1/research/activity', { params: { sessionId, page, size } })
      .then((r) => r.data),
};
