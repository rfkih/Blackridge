import { apiClient } from './client';
import { addOptionalParam, buildPageParams } from './queryParams';
import type { LoopReportPage, ListLoopReportParams } from '@/types/loop-reports';

export type { LoopReportRow, LoopReportStatus } from '@/types/loop-reports';

/**
 * Admin feed of self-improvement-loop reports. The `apiClient` interceptor unwraps the
 * `ResponseDto` envelope, so this resolves directly to the `PageEnvelope`.
 */
export async function listLoopReports(opts: ListLoopReportParams = {}): Promise<LoopReportPage> {
  const params: Record<string, string | number | boolean> = buildPageParams(opts, 20);
  addOptionalParam(params, 'reportType', opts.reportType);
  addOptionalParam(params, 'status', opts.status);
  addOptionalParam(params, 'sort', opts.sort);
  const { data } = await apiClient.get<LoopReportPage>('/api/v1/loop-reports', { params });
  return data;
}
