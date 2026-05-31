import { apiClient, researchClient } from './client';
import { toNum, toNumOrNull } from './coerce';
import { mapAccountStrategy } from './strategies';
import type { DeployStrategyPayload, LeaderboardEntry } from '@/types/leaderboard';
import type { BacktestLeaderboardEntry } from '@/types/leaderboardBacktest';
import type { AccountStrategy } from '@/types/strategy';
import type { BackendAccountStrategy } from '@/types/api';

/**
 * Public "Top Strategies" leaderboard surface on the Trading JVM
 * (`/api/v1/leaderboard`). Reads only the V102-approved strategy set, so
 * nothing unapproved is ever surfaced or deployable.
 *
 * The `ResponseDto` envelope is unwrapped by the axios client, so the typed
 * `data` here is the bare payload.
 */
const BASE = '/api/v1/leaderboard';

/** Wire row. Jackson serializes BigDecimal as number-or-string, so the numeric
 *  fields are coerced through `toNum` / `toNumOrNull` rather than trusted raw. */
interface BackendLeaderboardEntry {
  rank: number;
  symbol: string;
  strategyCode: string;
  intervalName: string | null;
  cagrPct: number | string | null;
  maxDrawdownPct: number | string | null;
  psr: number | string | null;
  deflatedSharpe: number | string | null;
  profitFactor: number | string | null;
  sortino: number | string | null;
  calmar: number | string | null;
  trades: number | null;
  nLive: number | null;
  walkForwardVerdict: string | null;
  driftStatus: string | null;
  capacityTier: string | null;
  score: number | string | null;
  computedAt: string | null;
  corrToBook: number | string | null;
  nearSubstitute: boolean | null;
  bestParams: Record<string, unknown> | null;
}

function mapEntry(e: BackendLeaderboardEntry): LeaderboardEntry {
  return {
    rank: e.rank,
    symbol: e.symbol,
    strategyCode: e.strategyCode,
    interval: e.intervalName ?? '',
    cagrPct: toNum(e.cagrPct),
    maxDrawdownPct: toNumOrNull(e.maxDrawdownPct),
    psr: toNumOrNull(e.psr),
    deflatedSharpe: toNumOrNull(e.deflatedSharpe),
    profitFactor: toNumOrNull(e.profitFactor),
    sortino: toNumOrNull(e.sortino),
    calmar: toNumOrNull(e.calmar),
    trades: e.trades ?? 0,
    nLive: e.nLive ?? null,
    walkForwardVerdict: e.walkForwardVerdict,
    driftStatus: e.driftStatus,
    capacityTier: e.capacityTier,
    score: toNum(e.score),
    computedAt: e.computedAt,
    corrToBook: toNumOrNull(e.corrToBook),
    nearSubstitute: e.nearSubstitute ?? false,
    bestParams: e.bestParams ?? {},
  };
}

/**
 * Ranked top-strategies list. When `accountId` is supplied the server annotates each
 * entry with correlation-to-book (informational; it never changes the rank). Returns a
 * bare array — the survivorship denominator is deferred until the FE deploy is wired.
 */
export async function getTopStrategies(
  limit = 10,
  accountId?: string,
): Promise<LeaderboardEntry[]> {
  const { data } = await apiClient.get<BackendLeaderboardEntry[]>(`${BASE}/top-strategies`, {
    params: accountId ? { limit, accountId } : { limit },
  });
  return data.map(mapEntry);
}

/**
 * One-click deploy a leaderboard strategy onto one of the caller's accounts.
 * The server re-validates the approval and re-derives interval / direction /
 * winning params from the evidence backtest, then lands a LIVE
 * (`enabled=true`) `account_strategy` row. Returns the created row so the UI
 * can deep-link to its detail page (where the user can flip it to paper).
 */
export async function deployStrategy(payload: DeployStrategyPayload): Promise<AccountStrategy> {
  const { data } = await apiClient.post<BackendAccountStrategy>(`${BASE}/deploy`, payload);
  return mapAccountStrategy(data);
}

/** Wire row for the backtest-candidate leaderboard. Same number-or-string
 *  BigDecimal coercion contract as {@link BackendLeaderboardEntry}. */
interface BackendBacktestLeaderboardEntry {
  rank: number;
  symbol: string;
  strategyCode: string;
  intervalName: string | null;
  backtestRunId: string;
  cagrPct: number | string | null;
  maxDrawdownPct: number | string | null;
  psr: number | string | null;
  deflatedSharpe: number | string | null;
  dsrNTrials: number | string | null;
  profitFactor: number | string | null;
  sortino: number | string | null;
  trades: number | null;
  winRate: number | string | null;
  dataStart: string | null;
  dataEnd: string | null;
  spanDays: number | string | null;
  walkForwardVerdict: string | null;
  bestParams: Record<string, unknown> | null;
}

function mapBacktestEntry(e: BackendBacktestLeaderboardEntry): BacktestLeaderboardEntry {
  return {
    rank: e.rank,
    symbol: e.symbol,
    strategyCode: e.strategyCode,
    interval: e.intervalName ?? '',
    backtestRunId: e.backtestRunId,
    cagrPct: toNumOrNull(e.cagrPct),
    maxDrawdownPct: toNumOrNull(e.maxDrawdownPct),
    psr: toNumOrNull(e.psr),
    deflatedSharpe: toNumOrNull(e.deflatedSharpe),
    dsrNTrials: toNumOrNull(e.dsrNTrials),
    profitFactor: toNumOrNull(e.profitFactor),
    sortino: toNumOrNull(e.sortino),
    trades: toNum(e.trades),
    winRate: toNumOrNull(e.winRate),
    dataStart: e.dataStart,
    dataEnd: e.dataEnd,
    spanDays: toNum(e.spanDays),
    walkForwardVerdict: e.walkForwardVerdict,
    bestParams: e.bestParams ?? {},
  };
}

/**
 * Best backtest run per (symbol, strategy, interval) cell. Explore-only
 * candidates — these have NOT cleared the V102 approval gate, so the UI offers
 * "Request approval" (not "Deploy"). Same `.data` envelope as `/top-strategies`.
 */
export async function fetchBacktestLeaderboard(limit = 20): Promise<BacktestLeaderboardEntry[]> {
  const { data } = await researchClient.get<BackendBacktestLeaderboardEntry[]>(`${BASE}/backtest`, {
    params: { limit },
  });
  return data.map(mapBacktestEntry);
}
