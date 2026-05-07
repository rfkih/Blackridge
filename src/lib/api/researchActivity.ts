/**
 * API module for quant-researcher agent activity endpoints.
 * All calls target the Research JVM (:8081) via `researchClient`.
 */
import { researchClient } from '@/lib/api/client';
import type { AgentActivity, AgentSessionSummary } from '@/types/research';

// Sessions endpoint returns a custom envelope (Map.of in controller)
export interface SessionsResponse {
  content: AgentSessionSummary[];
  page: number;
  size: number;
  total: number;
}

// Activities endpoint returns Spring Data Page<T> — uses 'number' not 'page',
// 'totalElements' not 'total'.
export interface ActivitiesResponse {
  content: AgentActivity[];
  number: number;        // 0-based page index
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
