import { apiClient } from './client';
import { addOptionalParam, buildPageParams } from './queryParams';
import type { AlertEventPage, ListAlertsParams } from '@/types/alerts';

export type { AlertEvent, AlertSeverity } from '@/types/alerts';

export async function listAlerts(opts: ListAlertsParams = {}): Promise<AlertEventPage> {
  const params: Record<string, string | number | boolean> = {
    ...buildPageParams(opts, 50),
    includeSuppressed: opts.includeSuppressed ?? true,
  };
  addOptionalParam(params, 'severity', opts.severity);
  addOptionalParam(params, 'kind', opts.kind);
  addOptionalParam(params, 'since', opts.since);
  addOptionalParam(params, 'search', opts.search);
  addOptionalParam(params, 'sort', opts.sort);
  const { data } = await apiClient.get<AlertEventPage>('/api/v1/alerts', { params });
  return data;
}
