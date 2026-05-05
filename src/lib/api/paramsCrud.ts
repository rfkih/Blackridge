import { apiClient } from './client';
import type { BackendParamResponse } from '@/types/api';

/**
 * Strategy-params CRUD share the same shape across LSR/VCB/VBO:
 *   GET  /defaults             → { effectiveParams }
 *   GET  /:accountStrategyId   → { effectiveParams }
 *   PUT  /:id (full)           → { effectiveParams }
 *   PATCH /:id (partial)       → { effectiveParams }
 *   DELETE /:id                → 204
 *
 * Each strategy's params module is just a thin alias around this factory so
 * call-sites keep their existing names (`getLsrParams`, `patchVcbParams`, …).
 */
export function createParamsCrud<T>(basePath: string) {
  const BASE = `/api/v1/${basePath}`;

  return {
    getDefaults: async (): Promise<T> => {
      const { data } = await apiClient.get<BackendParamResponse<T>>(`${BASE}/defaults`);
      return data.effectiveParams;
    },
    get: async (accountStrategyId: string): Promise<T> => {
      const { data } = await apiClient.get<BackendParamResponse<T>>(`${BASE}/${accountStrategyId}`);
      return data.effectiveParams;
    },
    put: async (accountStrategyId: string, params: T): Promise<T> => {
      const { data } = await apiClient.put<BackendParamResponse<T>>(
        `${BASE}/${accountStrategyId}`,
        params,
      );
      return data.effectiveParams;
    },
    patch: async (accountStrategyId: string, params: Partial<T>): Promise<T> => {
      const { data } = await apiClient.patch<BackendParamResponse<T>>(
        `${BASE}/${accountStrategyId}`,
        params,
      );
      return data.effectiveParams;
    },
    remove: async (accountStrategyId: string): Promise<void> => {
      await apiClient.delete(`${BASE}/${accountStrategyId}`);
    },
  };
}
