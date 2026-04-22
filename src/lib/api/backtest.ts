import type { PageResponse, UUID } from '@/types/api';
import type {
  BacktestEquityPoint,
  BacktestMetrics,
  BacktestRun,
  BacktestRunPayload,
  BacktestTrade,
  BackendBacktestRun,
} from '@/types/backtest';
import type { CandleData } from '@/types/market';
import { apiClient } from './client';

const BASE = '/api/v1/backtest';

function extractList<T>(data: T[] | PageResponse<T>): T[] {
  if (Array.isArray(data)) return data;
  return (data as PageResponse<T>).content ?? [];
}

/**
 * Strict number coercion. Returns null for null/undefined/NaN instead of
 * letting Number(undefined) → NaN leak downstream into `.toFixed()` crashes
 * and blank cells. The result is explicit: either a real number or null.
 */
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function numOr(v: unknown, fallback: number): number {
  const n = num(v);
  return n == null ? fallback : n;
}

/**
 * Best-effort metrics synthesis from the legacy flat BacktestRunResponse
 * shape. Only used when `metrics` is absent on the wire (older backends / the
 * legacy POST endpoint). Kept conservative — null out anything we can't
 * derive cleanly so the UI distinguishes "missing" from 0.
 */
function synthesiseLegacyMetrics(b: BackendBacktestRun): BacktestMetrics | null {
  const totalTrades = b.totalTrades;
  const winRate = num(b.winRate);
  const grossProfit = num(b.grossProfit);
  const grossLoss = num(b.grossLoss);
  const netProfit = num(b.netProfit);
  const initialCapital = num(b.initialCapital);
  const endingBalance = num(b.endingBalance);
  // Nothing to populate from if the wire has neither flat metrics nor any
  // derivable balances. Signal "no metrics yet" to the UI.
  if (
    totalTrades == null &&
    winRate == null &&
    netProfit == null &&
    grossProfit == null &&
    endingBalance == null
  ) {
    return null;
  }
  const totalReturn =
    netProfit != null
      ? netProfit
      : endingBalance != null && initialCapital != null
        ? endingBalance - initialCapital
        : null;
  const totalReturnPct =
    totalReturn != null && initialCapital && initialCapital !== 0
      ? (totalReturn / initialCapital) * 100
      : null;
  const profitFactor =
    grossProfit != null && grossLoss != null && grossLoss !== 0
      ? Math.abs(grossProfit / grossLoss)
      : null;
  return {
    totalReturn: totalReturn ?? 0,
    totalReturnPct: totalReturnPct ?? 0,
    winRate: winRate ?? 0,
    profitFactor,
    avgWinUsdt: null,
    avgLossUsdt: null,
    maxDrawdown: null,
    maxDrawdownPct: numOr(b.maxDrawdownPct, 0),
    sharpe: null,
    sortino: null,
    totalTrades: totalTrades ?? 0,
    winningTrades: b.totalWins ?? 0,
    losingTrades: b.totalLosses ?? 0,
  };
}

/**
 * Map the backend's nested BacktestRunDetailResponse into the frontend's
 * BacktestRun. metrics comes through as a nested object (or null on
 * non-COMPLETED runs); we preserve field nullability so the UI can render "—"
 * instead of lying with 0.
 */
function mapMetrics(m: BackendBacktestRun['metrics']): BacktestMetrics | null {
  if (!m) return null;
  return {
    totalReturn: numOr(m.totalReturn, 0),
    totalReturnPct: numOr(m.totalReturnPct, 0),
    winRate: numOr(m.winRate, 0),
    profitFactor: num(m.profitFactor),
    avgWinUsdt: num(m.avgWinUsdt),
    avgLossUsdt: num(m.avgLossUsdt),
    maxDrawdown: num(m.maxDrawdown),
    maxDrawdownPct: numOr(m.maxDrawdownPct, 0),
    sharpe: num(m.sharpe),
    sortino: num(m.sortino),
    totalTrades: numOr(m.totalTrades, 0),
    winningTrades: numOr(m.winningTrades, 0),
    losingTrades: numOr(m.losingTrades, 0),
  };
}

/**
 * Best-effort parse of the paramSnapshot JSONB column. Backend returns whatever
 * the submitter sent; we accept either a map of overrides or a legacy string,
 * and fall back to null rather than surfacing raw JSON to the UI.
 */
function mapParamSnapshot(raw: unknown): Record<string, Record<string, unknown>> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return mapParamSnapshot(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object') return null;
  // Only accept shapes that look like { [code]: { [key]: value } }. The wizard
  // replay flow silently skips non-conforming structures.
  const out: Record<string, Record<string, unknown>> = {};
  for (const [code, overrides] of Object.entries(raw as Record<string, unknown>)) {
    if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
      out[code] = { ...(overrides as Record<string, unknown>) };
    }
  }
  return Object.keys(out).length ? out : null;
}

export function mapBacktestRun(b: BackendBacktestRun): BacktestRun {
  // Accept either the new BacktestRunDetailResponse shape (id/symbol/fromDate)
  // or the legacy BacktestRunResponse shape (backtestRunId/asset/startTime).
  // The two endpoints that still emit the legacy shape are internal — we
  // shouldn't crash navigation when one sneaks through.
  const id = (b.id ?? b.backtestRunId ?? '') as UUID;
  const strategyCode = b.strategyCode ?? b.strategyName ?? '';
  const symbol = b.symbol ?? b.asset ?? '';
  const fromDate = b.fromDate ?? b.startTime ?? '';
  const toDate = b.toDate ?? b.endTime ?? '';
  const createdAt = b.createdAt ?? b.createdTime ?? '';
  const completedAt = b.completedAt ?? b.updatedTime ?? null;
  const metrics = b.metrics ? mapMetrics(b.metrics) : synthesiseLegacyMetrics(b);

  return {
    id,
    accountStrategyId: b.accountStrategyId ?? '',
    strategyAccountStrategyIds: b.strategyAccountStrategyIds ?? {},
    strategyCode,
    strategyName: b.strategyName ?? strategyCode,
    symbol,
    interval: b.interval ?? '',
    status: b.status ?? 'RUNNING',
    fromDate,
    toDate,
    initialCapital: numOr(b.initialCapital, 0),
    endingBalance: numOr(b.endingBalance, 0),
    metrics,
    createdAt,
    completedAt,
    errorMessage: b.errorMessage ?? null,
    paramSnapshot: mapParamSnapshot(b.paramSnapshot),
  };
}

/** Server-side sort keys the backend whitelists — see BacktestQueryService. */
export type BacktestSortKey =
  | 'createdAt'
  | 'returnPct'
  | 'sharpe'
  | 'maxDrawdownPct'
  | 'totalTrades'
  | 'winRate'
  | 'status'
  | 'symbol'
  | 'strategyCode';

export interface BacktestListFilters {
  status?: string;
  strategyCode?: string;
  symbol?: string;
  interval?: string;
  /** ISO LocalDateTime (e.g. `2026-01-01T00:00:00`) — matches Spring's
   *  `@DateTimeFormat(iso = DATE_TIME)` binding. */
  from?: string;
  to?: string;
  sortBy?: BacktestSortKey;
  sortDir?: 'ASC' | 'DESC';
  page?: number;
  size?: number;
}

export interface BacktestRunsPage {
  content: BacktestRun[];
  page: number;
  size: number;
  total: number;
  sortBy: BacktestSortKey;
  sortDir: 'ASC' | 'DESC';
}

/**
 * Paginated + filtered + sorted list. The backend accepts every param as
 * optional and returns a `{content, page, size, total, sortBy, sortDir}`
 * envelope. When the backend is on an older build that still emits a bare
 * array, fall back to synthesising the page metadata locally so older
 * deployments keep working.
 */
export async function listBacktestRuns(
  filters: BacktestListFilters = {},
): Promise<BacktestRunsPage> {
  const params: Record<string, unknown> = {};
  if (filters.status) params.status = filters.status;
  if (filters.strategyCode) params.strategyCode = filters.strategyCode;
  if (filters.symbol) params.symbol = filters.symbol.toUpperCase();
  if (filters.interval) params.interval = filters.interval;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.sortBy) params.sortBy = filters.sortBy;
  if (filters.sortDir) params.sortDir = filters.sortDir;
  if (filters.page != null) params.page = filters.page;
  if (filters.size != null) params.size = filters.size;

  const { data } = await apiClient.get<
    | BackendBacktestRun[]
    | (PageResponse<BackendBacktestRun> & { sortBy?: string; sortDir?: string })
  >(BASE, { params });

  const content = extractList(data).map(mapBacktestRun);
  const page = filters.page ?? 0;
  const size = filters.size ?? content.length;
  if (Array.isArray(data)) {
    return {
      content,
      page,
      size,
      total: content.length,
      sortBy: filters.sortBy ?? 'createdAt',
      sortDir: filters.sortDir ?? 'DESC',
    };
  }
  return {
    content,
    page: data.page ?? page,
    size: data.size ?? size,
    total: data.total ?? content.length,
    sortBy: (data.sortBy as BacktestSortKey) ?? filters.sortBy ?? 'createdAt',
    sortDir: (data.sortDir as 'ASC' | 'DESC') ?? filters.sortDir ?? 'DESC',
  };
}

export async function getBacktestRun(id: string): Promise<BacktestRun> {
  const { data } = await apiClient.get<BackendBacktestRun>(`${BASE}/${id}`);
  return mapBacktestRun(data);
}

export async function createBacktestRun(payload: BacktestRunPayload): Promise<BacktestRun> {
  const { data } = await apiClient.post<BackendBacktestRun>(BASE, payload);
  return mapBacktestRun(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Result-page endpoints — each maps the backend shape into the UI-friendly one.
// Timestamps are normalised to epoch ms for app code and to TV seconds at the
// chart boundary only (see buildTradeMarkers + candle normaliser below).
// ─────────────────────────────────────────────────────────────────────────────

interface BackendBacktestTradePosition {
  id: string;
  type: string;
  quantity: number;
  exitTime: number | string | null;
  exitPrice: number | null;
  exitReason: string | null;
  realizedPnl: number;
}

interface BackendBacktestTrade {
  id: string;
  backtestRunId: string;
  direction: string;
  entryTime: number | string;
  entryPrice: number;
  exitTime: number | string | null;
  exitPrice: number | null;
  stopLossPrice: number;
  tp1Price: number | null;
  tp2Price: number | null;
  quantity: number;
  realizedPnl: number;
  rMultiple: number;
  positions: BackendBacktestTradePosition[];
}

interface BackendEquityPoint {
  ts: number | string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

// Backend candles may arrive as either epoch-ms (long) or ISO strings; this
// covers both. TV needs seconds, domain code wants ms — we standardise on ms
// here and convert at render time.
interface BackendBacktestCandle {
  time?: number | string;
  openTime?: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function toEpochMs(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 32_503_680_000 ? value : value * 1_000;
  }
  const parsed = Date.parse(value as string);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapBacktestTrade(t: BackendBacktestTrade): BacktestTrade {
  return {
    id: t.id,
    backtestRunId: t.backtestRunId,
    direction: t.direction === 'SHORT' ? 'SHORT' : 'LONG',
    entryTime: toEpochMs(t.entryTime) ?? 0,
    entryPrice: Number(t.entryPrice),
    exitTime: toEpochMs(t.exitTime),
    exitPrice: t.exitPrice == null ? null : Number(t.exitPrice),
    stopLossPrice: Number(t.stopLossPrice),
    tp1Price: t.tp1Price == null ? null : Number(t.tp1Price),
    tp2Price: t.tp2Price == null ? null : Number(t.tp2Price),
    quantity: Number(t.quantity),
    realizedPnl: Number(t.realizedPnl),
    rMultiple: Number(t.rMultiple),
    positions: (t.positions ?? []).map((p) => ({
      id: p.id,
      type: (p.type as BacktestTrade['positions'][number]['type']) ?? 'SINGLE',
      quantity: Number(p.quantity),
      exitTime: toEpochMs(p.exitTime),
      exitPrice: p.exitPrice == null ? null : Number(p.exitPrice),
      exitReason: (p.exitReason as BacktestTrade['positions'][number]['exitReason']) ?? null,
      realizedPnl: Number(p.realizedPnl),
    })),
  };
}

export async function getBacktestTrades(id: string): Promise<BacktestTrade[]> {
  const { data } = await apiClient.get<BackendBacktestTrade[] | PageResponse<BackendBacktestTrade>>(
    `${BASE}/${id}/trades`,
  );
  return extractList(data).map(mapBacktestTrade);
}

export async function getBacktestCandles(id: string): Promise<CandleData[]> {
  const { data } = await apiClient.get<BackendBacktestCandle[]>(`${BASE}/${id}/candles`);
  return (data ?? [])
    .map((c) => {
      const ms = toEpochMs(c.time ?? c.openTime ?? null);
      return {
        time: ms == null ? NaN : Math.floor(ms / 1_000),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume ?? 0),
      };
    })
    .filter((c) => Number.isFinite(c.time))
    .sort((a, b) => a.time - b.time);
}

export async function getBacktestEquityPoints(id: string): Promise<BacktestEquityPoint[]> {
  const { data } = await apiClient.get<BackendEquityPoint[]>(`${BASE}/${id}/equity-points`);
  return (data ?? [])
    .map((p) => ({
      ts: toEpochMs(p.ts) ?? 0,
      equity: Number(p.equity),
      drawdown: Number(p.drawdown),
      drawdownPct: Number(p.drawdownPct),
    }))
    .filter((p) => p.ts > 0)
    .sort((a, b) => a.ts - b.ts);
}
