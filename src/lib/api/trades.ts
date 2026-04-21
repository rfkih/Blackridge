import { apiClient } from './client';
import type {
  LivePosition,
  PositionExitReason,
  PositionType,
  TradeDirection,
  TradePosition,
  TradeStatus,
  Trades,
} from '@/types/trading';
import type { PageResponse, UUID } from '@/types/api';

/**
 * Backend wire shapes. Jackson emits BigDecimal as either number or string
 * depending on config, so every numeric field here is a union. Enum-ish
 * strings (direction/status/type) arrive as raw strings — we narrow at the
 * boundary rather than trusting the wire.
 */
interface BackendTradePosition {
  id: string | null;
  tradeId: string | null;
  type: string | null;
  quantity: number | string | null;
  entryPrice: number | string | null;
  exitTime: number | null;
  exitPrice: number | string | null;
  exitReason: string | null;
  feeUsdt: number | string | null;
  realizedPnl: number | string | null;
}

interface BackendTrade {
  id: string | null;
  accountId: string | null;
  accountStrategyId: string | null;
  strategyCode: string | null;
  symbol: string | null;
  direction: string | null;
  status: string | null;
  entryTime: number | null;
  entryPrice: number | string | null;
  exitTime: number | null;
  exitAvgPrice: number | string | null;
  stopLossPrice: number | string | null;
  tp1Price: number | string | null;
  tp2Price: number | string | null;
  quantity: number | string | null;
  realizedPnl: number | string | null;
  unrealizedPnl: number | string | null;
  feeUsdt: number | string | null;
  markPrice: number | string | null;
  unrealizedPnlPct: number | string | null;
  positions: BackendTradePosition[] | null;
}

function extractList<T>(data: T[] | PageResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PageResponse<T>).content ?? [];
}

/** Required numeric field — null/NaN fall back to 0. */
function numOr0(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Optional numeric field — null stays null, never collapses to 0. */
function numOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asUuid(v: string | null | undefined): UUID {
  return v ?? '';
}

function narrowDirection(v: string | null | undefined): TradeDirection {
  return v === 'SHORT' ? 'SHORT' : 'LONG';
}

const TRADE_STATUSES: TradeStatus[] = ['OPEN', 'PARTIALLY_CLOSED', 'CLOSED'];
function narrowStatus(v: string | null | undefined): TradeStatus {
  const up = (v ?? '').toUpperCase();
  return (TRADE_STATUSES as string[]).includes(up) ? (up as TradeStatus) : 'CLOSED';
}

const POSITION_TYPES: PositionType[] = ['SINGLE', 'TP1', 'TP2', 'RUNNER'];
function narrowPositionType(v: string | null | undefined): PositionType {
  const up = (v ?? '').toUpperCase();
  return (POSITION_TYPES as string[]).includes(up) ? (up as PositionType) : 'SINGLE';
}

const EXIT_REASONS: PositionExitReason[] = [
  'TP_HIT',
  'SL_HIT',
  'RUNNER_CLOSE',
  'MANUAL_CLOSE',
  'BACKTEST_END',
];
function narrowExitReason(v: string | null | undefined): PositionExitReason | null {
  if (!v) return null;
  const up = v.toUpperCase();
  return (EXIT_REASONS as string[]).includes(up) ? (up as PositionExitReason) : null;
}

function mapPosition(p: BackendTradePosition): TradePosition {
  return {
    id: asUuid(p.id),
    tradeId: asUuid(p.tradeId),
    type: narrowPositionType(p.type),
    quantity: numOr0(p.quantity),
    entryPrice: numOr0(p.entryPrice),
    exitTime: p.exitTime ?? null,
    exitPrice: numOrNull(p.exitPrice),
    exitReason: narrowExitReason(p.exitReason),
    feeUsdt: numOr0(p.feeUsdt),
    realizedPnl: numOr0(p.realizedPnl),
  };
}

function mapTrade(t: BackendTrade): Trades {
  return {
    id: asUuid(t.id),
    accountId: asUuid(t.accountId),
    accountStrategyId: asUuid(t.accountStrategyId),
    strategyCode: t.strategyCode ?? '',
    symbol: t.symbol ?? '',
    direction: narrowDirection(t.direction),
    status: narrowStatus(t.status),
    entryTime: t.entryTime ?? 0,
    entryPrice: numOr0(t.entryPrice),
    exitTime: t.exitTime ?? null,
    exitAvgPrice: numOrNull(t.exitAvgPrice),
    stopLossPrice: numOr0(t.stopLossPrice),
    tp1Price: numOrNull(t.tp1Price),
    tp2Price: numOrNull(t.tp2Price),
    quantity: numOr0(t.quantity),
    realizedPnl: numOr0(t.realizedPnl),
    unrealizedPnl: numOr0(t.unrealizedPnl),
    feeUsdt: numOr0(t.feeUsdt),
    markPrice: numOrNull(t.markPrice),
    unrealizedPnlPct: numOrNull(t.unrealizedPnlPct),
    positions: (t.positions ?? []).map(mapPosition),
  };
}

/**
 * Open-trades list exposes LivePosition to the panel; internally we still map
 * from the same backend Trades shape so the boundary normalisation runs once.
 */
function tradeToLivePosition(t: Trades): LivePosition {
  return {
    tradeId: t.id,
    accountId: t.accountId,
    accountStrategyId: t.accountStrategyId,
    symbol: t.symbol,
    direction: t.direction,
    quantity: t.quantity,
    entryPrice: t.entryPrice,
    // Pass null through — UI renders "—" for absent marks instead of entryPrice
    // (which would falsely imply "no movement since open").
    markPrice: t.markPrice ?? null,
    unrealizedPnl: t.unrealizedPnl ?? 0,
    unrealizedPnlPct: t.unrealizedPnlPct ?? 0,
    openedAt: t.entryTime,
  };
}

export async function getOpenTrades(accountId?: string): Promise<LivePosition[]> {
  const params: Record<string, unknown> = { status: 'OPEN' };
  if (accountId) params.accountId = accountId;
  const { data } = await apiClient.get<BackendTrade[] | PageResponse<BackendTrade>>(
    '/api/v1/trades',
    { params },
  );
  return extractList(data).map(mapTrade).map(tradeToLivePosition);
}

export async function getRecentTrades(limit = 10, accountId?: string): Promise<Trades[]> {
  const params: Record<string, unknown> = { status: 'CLOSED', limit };
  if (accountId) params.accountId = accountId;
  const { data } = await apiClient.get<BackendTrade[] | PageResponse<BackendTrade>>(
    '/api/v1/trades',
    { params },
  );
  return extractList(data).map(mapTrade);
}

export async function getTradeById(id: string): Promise<Trades> {
  const { data } = await apiClient.get<BackendTrade>(`/api/v1/trades/${id}`);
  return mapTrade(data);
}
