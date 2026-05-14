import { apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';
import { extractList } from './pageUtils';
import type {
  LivePosition,
  PositionExitReason,
  PositionType,
  TradeAttribution,
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
    quantity: toNum(p.quantity),
    entryPrice: toNum(p.entryPrice),
    exitTime: p.exitTime ?? null,
    exitPrice: toNumOrNull(p.exitPrice),
    exitReason: narrowExitReason(p.exitReason),
    feeUsdt: toNum(p.feeUsdt),
    realizedPnl: toNum(p.realizedPnl),
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
    entryPrice: toNum(t.entryPrice),
    exitTime: t.exitTime ?? null,
    exitAvgPrice: toNumOrNull(t.exitAvgPrice),
    stopLossPrice: toNum(t.stopLossPrice),
    tp1Price: toNumOrNull(t.tp1Price),
    tp2Price: toNumOrNull(t.tp2Price),
    quantity: toNum(t.quantity),
    realizedPnl: toNum(t.realizedPnl),
    unrealizedPnl: toNum(t.unrealizedPnl),
    feeUsdt: toNum(t.feeUsdt),
    markPrice: toNumOrNull(t.markPrice),
    unrealizedPnlPct: toNumOrNull(t.unrealizedPnlPct),
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

export interface TradesPageFilters {
  status?: TradeStatus | 'ALL';
  strategyCode?: string;
  symbol?: string;
  from?: string; // ISO date yyyy-MM-dd
  to?: string;
  accountId?: string;
  page?: number; // zero-indexed
  size?: number;
}

export interface TradesPage {
  content: Trades[];
  page: number;
  size: number;
  total: number;
}

/**
 * Paginated trades list. Mirrors `GET /api/v1/trades?status=&strategyCode=&
 * symbol=&from=&to=&page=&size=`. The backend may emit either a bare array or
 * the Spring Page envelope depending on filter shape — extractList handles
 * both, and we synthesise missing page metadata so the caller always gets a
 * consistent `{ content, page, size, total }` shape.
 */
export async function getTradesPage(filters: TradesPageFilters = {}): Promise<TradesPage> {
  const params: Record<string, unknown> = {};
  if (filters.status && filters.status !== 'ALL') params.status = filters.status;
  if (filters.strategyCode) params.strategyCode = filters.strategyCode;
  if (filters.symbol) params.symbol = filters.symbol.toUpperCase();
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.accountId) params.accountId = filters.accountId;
  if (filters.page != null) params.page = filters.page;
  if (filters.size != null) params.size = filters.size;

  const { data } = await apiClient.get<BackendTrade[] | PageResponse<BackendTrade>>(
    '/api/v1/trades',
    { params },
  );

  const content = extractList(data).map(mapTrade);
  if (Array.isArray(data)) {
    return {
      content,
      page: filters.page ?? 0,
      size: filters.size ?? content.length,
      total: content.length,
    };
  }
  return {
    content,
    page: data.page ?? filters.page ?? 0,
    size: data.size ?? filters.size ?? content.length,
    total: data.total ?? content.length,
  };
}

export async function getTradeById(id: string): Promise<Trades> {
  const { data } = await apiClient.get<BackendTrade>(`/api/v1/trades/${id}`);
  return mapTrade(data);
}

/**
 * Manually close every open position on a trade. The backend places a
 * Binance market order in the opposite direction for the full remaining
 * quantity and stamps the closed positions with exitReason=MANUAL_CLOSE.
 * Returns the refreshed trade (now usually status=CLOSED).
 */
export async function closeTrade(id: string): Promise<Trades> {
  const { data } = await apiClient.post<BackendTrade>(`/api/v1/trades/${id}/close`);
  return mapTrade(data);
}

interface BackendTradeAttribution {
  realizedPnl: number | string | null;
  signalAlpha: number | string | null;
  executionDrift: number | string | null;
  sizingResidual: number | string | null;
  entrySlippagePct: number | string | null;
  sizeRatio: number | string | null;
}

export async function getTradeAttribution(id: string): Promise<TradeAttribution | null> {
  const { data } = await apiClient.get<BackendTradeAttribution | null>(
    `/api/v1/trades/${id}/attribution`,
  );
  if (!data) return null;
  return {
    realizedPnl: toNum(data.realizedPnl),
    signalAlpha: toNum(data.signalAlpha),
    executionDrift: toNum(data.executionDrift),
    sizingResidual: toNum(data.sizingResidual),
    entrySlippagePct: toNumOrNull(data.entrySlippagePct),
    sizeRatio: toNumOrNull(data.sizeRatio),
  };
}

/**
 * Trade-state anomalies for the admin /research stuck-trade panel. Healthy
 * state returns []; one row per inconsistent parent trade otherwise. See
 * {@code TradeAnomalyService} on the backend for the classification rules.
 */
export type TradeAnomalyType =
  | 'OPEN_NO_CHILDREN'
  | 'OPEN_NO_OPEN_CHILDREN'
  | 'PARTIAL_NO_OPEN_CHILDREN';

export interface TradeAnomaly {
  tradeId: string;
  accountId: string;
  accountStrategyId: string;
  asset: string;
  interval: string;
  side: string;
  status: string;
  entryTime: string | null;
  totalLegs: number;
  openLegs: number;
  anomalyType: TradeAnomalyType;
}

export async function getTradeAnomalies(): Promise<TradeAnomaly[]> {
  const { data } = await apiClient.get<TradeAnomaly[]>('/api/v1/trades/anomalies');
  return Array.isArray(data) ? data : [];
}
