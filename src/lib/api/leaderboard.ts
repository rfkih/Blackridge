import { apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';
import { mapAccountStrategy } from './strategies';
import type { DeployStrategyPayload, LeaderboardEntry, LeaderboardPage } from '@/types/leaderboard';
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

/** Wire shape of the leaderboard page wrapper. */
interface BackendLeaderboardPage {
  entries: BackendLeaderboardEntry[];
  approvedCount: number | null;
  revokedCount: number | null;
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
 * Ranked leaderboard page. When `accountId` is supplied the server annotates each
 * entry with correlation-to-book (informational; it never changes the rank).
 */
export async function getTopStrategies(limit = 10, accountId?: string): Promise<LeaderboardPage> {
  const { data } = await apiClient.get<BackendLeaderboardPage>(`${BASE}/top-strategies`, {
    params: accountId ? { limit, accountId } : { limit },
  });
  return {
    entries: (data.entries ?? []).map(mapEntry),
    approvedCount: data.approvedCount ?? 0,
    revokedCount: data.revokedCount ?? 0,
  };
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
