import { apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';
import { extractList } from './pageUtils';
import type { PageResponse } from '@/types/api';
import type { CarryPair, CarryStatus } from '@/types/trading';

/** Wire shape from `GET /api/v1/carry/pairs` (Jackson BigDecimal → number or string). */
interface BackendCarryPair {
  id: string | null;
  accountId: string | null;
  accountStrategyId: string | null;
  symbol: string | null;
  status: string | null;
  simulated: boolean | null;
  spotSide: string | null;
  spotQty: number | string | null;
  spotEntryPrice: number | string | null;
  perpSide: string | null;
  perpQty: number | string | null;
  perpEntryPrice: number | string | null;
  perpLeverage: number | string | null;
  fundingPnl: number | string | null;
  markPrice: number | string | null;
  unrealizedPnl: number | string | null;
  totalPnl: number | string | null;
  netDeltaBase: number | string | null;
  lastRebalanceAt: string | null;
  createdAt: string | null;
}

const CARRY_STATUSES: CarryStatus[] = [
  'PENDING',
  'OPENING',
  'OPEN',
  'REBALANCING',
  'CLOSING',
  'CLOSED',
  'FAILED',
];

function narrowStatus(v: string | null | undefined): CarryStatus {
  const up = (v ?? '').toUpperCase();
  return (CARRY_STATUSES as string[]).includes(up) ? (up as CarryStatus) : 'CLOSED';
}

function mapCarryPair(c: BackendCarryPair): CarryPair {
  return {
    id: c.id ?? '',
    accountId: c.accountId ?? '',
    accountStrategyId: c.accountStrategyId ?? '',
    symbol: c.symbol ?? '',
    status: narrowStatus(c.status),
    simulated: Boolean(c.simulated),
    spotSide: c.spotSide ?? 'LONG',
    spotQty: toNum(c.spotQty),
    spotEntryPrice: toNum(c.spotEntryPrice),
    perpSide: c.perpSide ?? 'SHORT',
    perpQty: toNum(c.perpQty),
    perpEntryPrice: toNum(c.perpEntryPrice),
    perpLeverage: toNumOrNull(c.perpLeverage),
    fundingPnl: toNum(c.fundingPnl),
    markPrice: toNumOrNull(c.markPrice),
    unrealizedPnl: toNumOrNull(c.unrealizedPnl),
    totalPnl: toNumOrNull(c.totalPnl),
    netDeltaBase: toNumOrNull(c.netDeltaBase),
    lastRebalanceAt: c.lastRebalanceAt,
    createdAt: c.createdAt,
  };
}

/** The authenticated user's carry book (delta-neutral pairs), newest first. */
export async function getCarryPairs(): Promise<CarryPair[]> {
  const { data } = await apiClient.get<BackendCarryPair[] | PageResponse<BackendCarryPair>>(
    '/api/v1/carry/pairs',
  );
  return extractList(data).map(mapCarryPair);
}
