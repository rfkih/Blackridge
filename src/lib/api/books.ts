import { apiClient } from './client';
import { extractList } from './pageUtils';
import { toNum } from './coerce';
import type { PortfolioBook, SleeveTarget } from '@/types/equity';

export async function getBooks(): Promise<PortfolioBook[]> {
  const { data } = await apiClient.get('/api/portfolio-books');
  return extractList<Record<string, unknown>>(data).map((b) => ({
    bookCode: b.bookCode as string,
    version: toNum(b.version as number | string | null | undefined),
    status: b.status as PortfolioBook['status'],
    frozenAt: (b.frozenAt as string | null) ?? null,
    createdTime: b.createdTime as string,
    config: (b.config as Record<string, unknown> | undefined) ?? undefined,
  }));
}

export async function getBookTargets(
  bookCode: string,
  asOfDate?: string,
  version?: number,
): Promise<SleeveTarget[]> {
  const params: Record<string, string | number> = {};
  if (asOfDate) params.asOfDate = asOfDate;
  if (version != null) params.version = version;
  const { data } = await apiClient.get(
    `/api/portfolio-books/${encodeURIComponent(bookCode)}/targets`,
    Object.keys(params).length ? { params } : undefined,
  );
  return extractList<Record<string, unknown>>(data).map((t) => ({
    targetId: t.targetId as string,
    bookCode: t.bookCode as string,
    bookVersion: toNum(t.bookVersion as number | string | null | undefined),
    sleeveCode: t.sleeveCode as string,
    symbol: t.symbol as string,
    exchange: t.exchange as string,
    currency: t.currency as string,
    side: t.side as SleeveTarget['side'],
    targetWeight: toNum(t.targetWeight as number | string | null | undefined),
    targetNotional: toNum(t.targetNotional as number | string | null | undefined),
    asOfDate: t.asOfDate as string,
  }));
}
