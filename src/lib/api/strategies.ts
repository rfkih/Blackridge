import { apiClient } from './client';
import { toNum } from './coerce';
import { extractList } from './pageUtils';
import type { AccountStrategy, AccountStrategyStatus, KellyStatus } from '@/types/strategy';
import type { BackendAccountStrategy, PageResponse } from '@/types/api';

/** Map Java DTO field names to the frontend AccountStrategy shape. */
function mapAccountStrategy(s: BackendAccountStrategy): AccountStrategy {
  return {
    id: s.accountStrategyId,
    accountId: s.accountId,
    strategyCode: s.strategyCode,
    presetName: (s.presetName ?? '').trim() || 'Default',
    symbol: s.symbol,
    interval: s.intervalName,
    status: (s.enabled ? 'LIVE' : 'STOPPED') as AccountStrategyStatus,
    simulated: Boolean(s.simulated),
    capitalAllocationPct: toNum(s.capitalAllocationPct),
    maxOpenPositions: toNum(s.maxOpenPositions),
    allowLong: s.allowLong,
    allowShort: s.allowShort,
    priorityOrder: s.priorityOrder,
    createdAt: s.createdTime,
    updatedAt: s.updatedTime,
    ddKillThresholdPct: toNum(s.ddKillThresholdPct),
    isKillSwitchTripped: Boolean(s.isKillSwitchTripped),
    killSwitchTrippedAt: s.killSwitchTrippedAt ?? null,
    killSwitchReason: s.killSwitchReason ?? null,
    regimeGateEnabled: Boolean(s.regimeGateEnabled),
    allowedTrendRegimes: s.allowedTrendRegimes ?? null,
    allowedVolatilityRegimes: s.allowedVolatilityRegimes ?? null,
    kellySizingEnabled: Boolean(s.kellySizingEnabled),
    kellyMaxFraction: toNum(s.kellyMaxFraction) || 0.25,
  };
}

export async function getAccountStrategies(userId?: string): Promise<AccountStrategy[]> {
  const params: Record<string, unknown> = {};
  if (userId) params.userId = userId;
  const { data } = await apiClient.get<
    BackendAccountStrategy[] | PageResponse<BackendAccountStrategy>
  >('/api/v1/account-strategies', { params });
  return extractList(data).map(mapAccountStrategy);
}

export async function getAccountStrategyById(id: string): Promise<AccountStrategy> {
  const { data } = await apiClient.get<BackendAccountStrategy>(`/api/v1/account-strategies/${id}`);
  return mapAccountStrategy(data);
}

export interface CreateAccountStrategyPayload {
  accountId: string;
  strategyCode: string;
  /** Optional user-facing preset label. Backend auto-names as "Preset N" if omitted. */
  presetName?: string;
  symbol: string;
  intervalName: string;
  allowLong: boolean;
  allowShort: boolean;
  maxOpenPositions: number;
  capitalAllocationPct: number;
  priorityOrder: number;
  enabled?: boolean;
}

export async function createAccountStrategy(
  payload: CreateAccountStrategyPayload,
): Promise<AccountStrategy> {
  const { data } = await apiClient.post<BackendAccountStrategy>(
    '/api/v1/account-strategies',
    payload,
  );
  return mapAccountStrategy(data);
}

export async function deleteAccountStrategy(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/account-strategies/${id}`);
}

/**
 * Activate this preset for its (account, strategy, symbol, interval) tuple.
 * Any currently-active sibling is deactivated atomically. Rejects (409) if a
 * sibling with open trades would have to be deactivated first.
 */
export async function activateAccountStrategy(id: string): Promise<AccountStrategy> {
  const { data } = await apiClient.post<BackendAccountStrategy>(
    `/api/v1/account-strategies/${id}/activate`,
  );
  return mapAccountStrategy(data);
}

/**
 * Stop this preset from taking new entries. Open positions are left intact —
 * the live listener continues managing them until they close naturally.
 */
export async function deactivateAccountStrategy(id: string): Promise<AccountStrategy> {
  const { data } = await apiClient.post<BackendAccountStrategy>(
    `/api/v1/account-strategies/${id}/deactivate`,
  );
  return mapAccountStrategy(data);
}

/**
 * Update editable fields on an account strategy. All fields optional —
 * server applies whichever are present. Backend rejects an interval
 * change with 409 if open trades reference the strategy; priority
 * changes have no such guard since priority only affects future entry
 * fan-out.
 */
export interface AccountStrategyPatch {
  intervalName?: string;
  /** 1–99 inclusive. Lower wins the orchestrator's fan-out tiebreak. */
  priorityOrder?: number;
  /** Regime gate (V43) */
  regimeGateEnabled?: boolean;
  allowedTrendRegimes?: string;
  allowedVolatilityRegimes?: string;
  /** Kelly/bankroll sizing (V45) */
  kellySizingEnabled?: boolean;
  /** Hard cap on the Kelly fraction [0.05, 1.00]. */
  kellyMaxFraction?: number;
}

export async function updateAccountStrategy(
  id: string,
  patch: AccountStrategyPatch,
): Promise<AccountStrategy> {
  const { data } = await apiClient.patch<BackendAccountStrategy>(
    `/api/v1/account-strategies/${id}`,
    patch,
  );
  return mapAccountStrategy(data);
}

/**
 * Fetch the live Kelly status — current multiplier, qualifying-run count,
 * and a human-readable reason. Backend-computed from the most recent
 * qualifying backtest runs; refresh whenever the strategy's Kelly config
 * changes or a new backtest completes.
 */
export async function getKellyStatus(id: string): Promise<KellyStatus> {
  const { data } = await apiClient.get<{
    enabled: boolean;
    currentMultiplier: number | string;
    maxFraction: number | string | null;
    qualifyingRuns: number;
    reason: string;
  }>(`/api/v1/account-strategies/${id}/kelly-status`);
  return {
    enabled: Boolean(data.enabled),
    currentMultiplier: Number(data.currentMultiplier),
    maxFraction: data.maxFraction == null ? null : Number(data.maxFraction),
    qualifyingRuns: data.qualifyingRuns,
    reason: data.reason,
  };
}

/**
 * Clear the drawdown kill-switch on this strategy. Caller is expected to
 * have already looked at the trip reason — this is the explicit
 * acknowledgement that resumes new entries.
 */
export async function rearmKillSwitch(id: string): Promise<AccountStrategy> {
  const { data } = await apiClient.post<BackendAccountStrategy>(
    `/api/v1/account-strategies/${id}/rearm`,
  );
  return mapAccountStrategy(data);
}
