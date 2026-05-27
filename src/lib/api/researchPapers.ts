import { apiClient } from './client';
import { env } from '@/lib/env';
import type { ChartData, GeneratedPaper, PaperDetail, PaperPage, PaperStatus } from '@/types/papers';

const BASE = '/api/v1/research-orch/papers';

export async function listPapers(params?: {
  paperStatus?: PaperStatus;
  strategyCode?: string;
  instrument?: string;
  intervalName?: string;
  cursor?: string | null | undefined;
  limit?: number;
}): Promise<PaperPage> {
  const { data } = await apiClient.get<PaperPage>(BASE, {
    params: {
      paper_status: params?.paperStatus || undefined,
      strategy_code: params?.strategyCode || undefined,
      instrument: params?.instrument || undefined,
      interval_name: params?.intervalName || undefined,
      cursor: params?.cursor || undefined,
      limit: params?.limit ?? 20,
    },
  });
  return data;
}

export async function getPaper(paperId: string): Promise<PaperDetail> {
  const { data } = await apiClient.get<PaperDetail>(`${BASE}/${paperId}`);
  return data;
}

export async function getPaperChartData(paperId: string): Promise<ChartData> {
  const { data } = await apiClient.get<ChartData>(`${BASE}/${paperId}/chart-data`);
  return data;
}

export async function generatePaper(
  queueId: string,
  idempotencyKey: string,
): Promise<GeneratedPaper> {
  const { data } = await apiClient.post<GeneratedPaper>(
    `${BASE}/${queueId}/generate`,
    {},
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return data;
}

/** Absolute URL for a direct browser download. Must be absolute so the
 *  browser hits the JVM (which handles auth + proxy) rather than the
 *  Next.js server, which has no handler for /api/v1/research-orch/**. */
export function paperLatexHref(paperId: string): string {
  return `${env.apiUrl}${BASE}/${paperId}/export/latex`;
}

export function paperPdfHref(paperId: string): string {
  return `${env.apiUrl}${BASE}/${paperId}/export/pdf`;
}
