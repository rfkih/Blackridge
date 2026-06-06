import type { BackendAccountStrategy, PageResponse, UUID } from '@/types/api';
import type {
  BacktestEquityPoint,
  BacktestMetrics,
  BacktestRun,
  BacktestRunPayload,
  BacktestTrade,
  BackendBacktestRun,
} from '@/types/backtest';
import type { CandleData } from '@/types/market';
import type { AccountStrategy } from '@/types/strategy';

import { researchClient as apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';
import { extractList } from './pageUtils';
import { addOptionalParam } from './queryParams';
import { mapAccountStrategy } from './strategies';

const BASE = '/api/v1/backtest';

/**
 * Best-effort metrics synthesis from the legacy flat BacktestRunResponse
 * shape. Only used when `metrics` is absent on the wire (older backends / the
 * legacy POST endpoint). Kept conservative â€” null out anything we can't
 * derive cleanly so the UI distinguishes "missing" from 0.
 */
function synthesiseLegacyMetrics(b: BackendBacktestRun): BacktestMetrics | null {
  const totalTrades = b.totalTrades;
  const winRate = toNumOrNull(b.winRate);
  const grossProfit = toNumOrNull(b.grossProfit);
  const grossLoss = toNumOrNull(b.grossLoss);
  const netProfit = toNumOrNull(b.netProfit);
  const initialCapital = toNumOrNull(b.initialCapital);
  const endingBalance = toNumOrNull(b.endingBalance);

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
    maxDrawdownPct: toNum(b.maxDrawdownPct, 0),
    sharpe: null,
    sortino: null,
    psr: null,
    totalTrades: totalTrades ?? 0,
    winningTrades: b.totalWins ?? 0,
    losingTrades: b.totalLosses ?? 0,
    avgTradeReturnPct: toNumOrNull(b.avgTradeReturnPct),
    geometricReturnPctAtAlloc90: toNumOrNull(b.geometricReturnPctAtAlloc90),
  };
}

/**
 * Map the backend's nested BacktestRunDetailResponse into the frontend's
 * BacktestRun. metrics comes through as a nested object (or null on
 * non-COMPLETED runs); we preserve field nullability so the UI can render "â€”"
 * instead of lying with 0.
 */
function mapMetrics(m: BackendBacktestRun['metrics']): BacktestMetrics | null {
  if (!m) return null;
  return {
    totalReturn: toNum(m.totalReturn, 0),
    totalReturnPct: toNum(m.totalReturnPct, 0),
    winRate: toNum(m.winRate, 0),
    profitFactor: toNumOrNull(m.profitFactor),
    avgWinUsdt: toNumOrNull(m.avgWinUsdt),
    avgLossUsdt: toNumOrNull(m.avgLossUsdt),
    maxDrawdown: toNumOrNull(m.maxDrawdown),
    maxDrawdownPct: toNum(m.maxDrawdownPct, 0),
    sharpe: toNumOrNull(m.sharpe),
    sortino: toNumOrNull(m.sortino),
    psr: toNumOrNull(m.psr),
    totalTrades: toNum(m.totalTrades, 0),
    winningTrades: toNum(m.winningTrades, 0),
    losingTrades: toNum(m.losingTrades, 0),
    avgTradeReturnPct: toNumOrNull(m.avgTradeReturnPct),
    geometricReturnPctAtAlloc90: toNumOrNull(m.geometricReturnPctAtAlloc90),
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
    } catch (err) {
      console.warn('[backtest] paramSnapshot JSON.parse failed â€” treating as no snapshot:', err);
      return null;
    }
  }
  if (typeof raw !== 'object') return null;

  const out: Record<string, Record<string, unknown>> = {};
  for (const [code, overrides] of Object.entries(raw as Record<string, unknown>)) {
    if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
      out[code] = { ...(overrides as Record<string, unknown>) };
    }
  }
  return Object.keys(out).length ? out : null;
}

function mapBacktestRun(b: BackendBacktestRun): BacktestRun {
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
    status: b.status ?? 'PENDING',
    progressPercent: Math.max(0, Math.min(100, Math.round(toNum(b.progressPercent, 0)))),
    fromDate,
    toDate,
    initialCapital: toNum(b.initialCapital, 0),
    endingBalance: toNum(b.endingBalance, 0),
    metrics,
    createdAt,
    completedAt,
    errorMessage: b.errorMessage ?? null,
    paramSnapshot: mapParamSnapshot(b.paramSnapshot),
    effectiveParamsSnapshot: mapParamSnapshot(b.effectiveParamsSnapshot),
    gitCommitSha: b.gitCommitSha ?? null,
    appVersion: b.appVersion ?? null,
    triggeredBy: b.triggeredBy === 'RESEARCHER' ? 'RESEARCHER' : 'USER',
    allowLong: typeof b.allowLong === 'boolean' ? b.allowLong : null,
    allowShort: typeof b.allowShort === 'boolean' ? b.allowShort : null,
    maxConcurrentStrategies:
      typeof b.maxConcurrentStrategies === 'number' ? b.maxConcurrentStrategies : null,
    strategyAllocations: coerceStrategyAllocations(b.strategyAllocations),
    strategyRiskPcts: coerceStrategyAllocations(b.strategyRiskPcts),
    strategyAllowLong: coerceStrategyBoolMap(b.strategyAllowLong),
    strategyAllowShort: coerceStrategyBoolMap(b.strategyAllowShort),

    strategyKillSwitchOverrides: coerceStrategyBoolMap(b.strategyKillSwitchOverrides),
    strategyRegimeOverrides: coerceStrategyBoolMap(b.strategyRegimeOverrides),
    strategyCorrelationOverrides: coerceStrategyBoolMap(b.strategyCorrelationOverrides),
    strategyConcurrentCapOverrides: coerceStrategyBoolMap(b.strategyConcurrentCapOverrides),
    strategyIntervals: coerceStrategyIntervals(b.strategyIntervals),
    fundingRateBpsPer8h: coerceNullableNumber(b.fundingRateBpsPer8h),
    strategyMlGateOverrides: coerceStrategyBoolMap(b.strategyMlGateOverrides),
    strategyMlSignalNameOverrides: coerceStrategyIntervals(b.strategyMlSignalNameOverrides),
    strategyMlShadowModeOverrides: coerceStrategyBoolMap(b.strategyMlShadowModeOverrides),
    strategyKind: b.strategyKind ?? null,
  };
}

function coerceNullableNumber(raw: number | string | null | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function coerceStrategyAllocations(
  raw: Record<string, number | string> | null | undefined,
): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function coerceStrategyIntervals(
  raw: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.length > 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** V58 â€” coerce a per-strategy boolean override map (allowLong / allowShort).
 *  Drops non-boolean values so a wire glitch doesn't silently flip a flag. */
function coerceStrategyBoolMap(
  raw: Record<string, boolean> | null | undefined,
): Record<string, boolean> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Server-side sort keys the backend whitelists â€” see BacktestQueryService. */
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
  /** Scope to a strategy kind — 'HEDGING' or 'TRADING'. Used to show only the
   *  active account's backtests. Omit for all. */
  strategyKind?: string;
  symbol?: string;
  interval?: string;
  /** ISO LocalDateTime (e.g. `2026-01-01T00:00:00`) â€” matches Spring's
   *  `@DateTimeFormat(iso = DATE_TIME)` binding. */
  from?: string;
  to?: string;
  sortBy?: BacktestSortKey;
  sortDir?: 'ASC' | 'DESC';
  page?: number;
  size?: number;
  /** Filter by run origin. 'USER' shows only the caller's own runs;
   *  'RESEARCHER' shows only researcher-submitted runs; omit for all. */
  triggeredBy?: 'USER' | 'RESEARCHER';
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
  const params: Record<string, string | number | boolean> = {};
  addOptionalParam(params, 'status', filters.status);
  addOptionalParam(params, 'strategyCode', filters.strategyCode);
  addOptionalParam(params, 'strategyKind', filters.strategyKind);
  addOptionalParam(params, 'symbol', filters.symbol?.toUpperCase());
  addOptionalParam(params, 'interval', filters.interval);
  addOptionalParam(params, 'from', filters.from);
  addOptionalParam(params, 'to', filters.to);
  addOptionalParam(params, 'sortBy', filters.sortBy);
  addOptionalParam(params, 'sortDir', filters.sortDir);
  if (filters.page != null) params.page = filters.page;
  if (filters.size != null) params.size = filters.size;
  addOptionalParam(params, 'triggeredBy', filters.triggeredBy);

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
  strategyCode?: string | null;
  strategyName?: string | null;
  interval?: string | null;
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

interface BackendBacktestEquityPoint {
  ts: number | string;
  equity: number;
  drawdown: number;
  drawdownPct: number;
}

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
    strategyCode: t.strategyCode ?? null,
    strategyName: t.strategyName ?? t.strategyCode ?? null,
    interval: t.interval ?? null,
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
  const { data } = await apiClient.get<BackendBacktestEquityPoint[]>(`${BASE}/${id}/equity-points`);
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

export interface ActivateStrategyPayload {
  strategyCode: string;
  accountStrategyId: string;
  /** Optional preset label. Auto-generated by the backend when omitted. */
  presetName?: string;
}

/**
 * Promote a completed backtest run's parameter snapshot to a user-owned account
 * strategy. Creates a new active preset from the run's configSnapshot and enables
 * the strategy for paper trading.
 */
export async function activateBacktestStrategy(
  runId: string,
  payload: ActivateStrategyPayload,
): Promise<AccountStrategy> {
  const { data } = await apiClient.post<BackendAccountStrategy>(
    `${BASE}/${runId}/activate-strategy`,
    payload,
  );
  return mapAccountStrategy(data);
}
