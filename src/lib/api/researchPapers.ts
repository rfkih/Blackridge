import { apiClient } from './client';
import type {
  ChartData,
  GeneratedPaper,
  PaperDetail,
  PaperPage,
  PaperStatus,
} from '@/types/papers';

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

/** Relative path for download anchors. Same-origin so the JWT cookie is
 *  attached and the Next.js rewrite forwards to the trading JVM, which
 *  proxies through to the orchestrator. Absolute URLs would skip the
 *  rewrite and trip SameSite=Lax cookie dropping on cross-origin GETs. */
export function paperLatexHref(paperId: string): string {
  return `${BASE}/${paperId}/export/latex`;
}

export function paperPdfHref(paperId: string): string {
  return `${BASE}/${paperId}/export/pdf`;
}

/** Fetch a paper export as a Blob via the auth-aware Axios client. Used
 *  when the endpoint can return a non-2xx (e.g. PDF when pdflatex isn't
 *  installed → 503 JSON envelope). A plain `<a download>` would save the
 *  error envelope as a corrupt .pdf; this throws so the caller can toast. */
export async function downloadPaperExport(paperId: string, format: 'latex' | 'pdf'): Promise<Blob> {
  const expected = format === 'pdf' ? 'application/pdf' : 'application/x-tex';
  const response = await apiClient.get<Blob>(`${BASE}/${paperId}/export/${format}`, {
    responseType: 'blob',
  });
  const blob = response.data;
  if (blob.type && !blob.type.startsWith(expected)) {
    const text = await blob.text();
    throw new Error(text || `Unexpected response type ${blob.type}`);
  }
  return blob;
}
