import { equityClient } from './client';
import { extractList } from './pageUtils';
import { toNum, toNumOrNull } from './coerce';
import type { EquityPosition, EquityOrder, EquityProfile } from '@/types/equity';

export async function getEquityPositions(
  profile: EquityProfile = 'PAPER',
): Promise<EquityPosition[]> {
  const { data } = await equityClient.get('/positions', { params: { profile } });
  return extractList<Record<string, unknown>>(data).map((p) => ({
    symbol: p.symbol as string,
    profile: p.profile as EquityProfile,
    venue: p.venue as string,
    bookCode: (p.bookCode as string | null) ?? null,
    sleeveCode: (p.sleeveCode as string | null) ?? null,
    qty: toNum(p.qty as number | string | null | undefined),
    avgPrice: toNumOrNull(p.avgPrice as number | string | null | undefined),
  }));
}

export async function getEquityOrders(
  profile: EquityProfile = 'PAPER',
  asOfDate?: string,
): Promise<EquityOrder[]> {
  const params: Record<string, string> = { profile };
  if (asOfDate) params.asOfDate = asOfDate;
  const { data } = await equityClient.get('/orders', { params });
  return extractList<Record<string, unknown>>(data).map((o) => ({
    symbol: o.symbol as string,
    side: o.side as EquityOrder['side'],
    qty: toNum(o.qty as number | string | null | undefined),
    status: o.status as EquityOrder['status'],
    brokerOrderId: (o.brokerOrderId as string | null) ?? null,
    asOfDate: o.asOfDate as string,
    profile: o.profile as EquityProfile,
  }));
}
