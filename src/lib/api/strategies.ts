import { apiClient } from './client';
import { toNum } from './coerce';
import { extractList } from './pageUtils';
import { addOptionalParam } from './queryParams';
import type { AccountStrategy, AccountStrategyStatus, KellyStatus } from '@/types/strategy';
import type { BackendAccountStrategy, PageResponse } from '@/types/api';

/**
 * V66 — derive the user-facing status from the two execution flags so the
 * dashboard never labels a simulated row as `LIVE`:
 *
 *   STOPPED  enabled=false  (orchestrator skips it)
 *   PAPER    enabled=true, simulated=true  (paper_trade_run target)
 *   LIVE     enabled=true, simulated=false (real Binance orders)
 *
 * Definition-scope `simulated` is not visible here — even if def.simulated=true
 * forces this row's decisions to paper at runtime, the wire still reports
 * row.simulated honestly. The mapper trusts what the backend sends.
 */
function deriveStatus(enabled: boolean, simulated: boolean): AccountStrategyStatus {
  if (!enabled) return 'STOPPED';
  return simulated ? 'PAPER' : 'LIVE';
}

/** Map Java DTO field names to the frontend AccountStrategy shape.
 *  Accepts both new @JsonProperty wire names (id, interval, status, createdAt,
 *  updatedAt) and the legacy Java field names for backwards compatibility. */
export function mapAccountStrategy(s: BackendAccountStrategy): AccountStrategy {
  return {
    id: (s.id ?? s.accountStrategyId) as string,
    accountId: s.accountId,
    strategyCode: s.strategyCode,
    presetName: (s.presetName ?? '').trim() || 'Default',
    symbol: s.symbol,
    interval: (s.interval ?? s.intervalName ?? '') as string,
    status: deriveStatus(Boolean(s.enabled), Boolean(s.simulated)),
    simulated: Boolean(s.simulated),
    capitalAllocationPct: toNum(s.capitalAllocationPct),
    maxOpenPositions: toNum(s.maxOpenPositions),
    allowLong: s.allowLong,
    allowShort: s.allowShort,
    priorityOrder: s.priorityOrder,
    createdAt: (s.createdAt ?? s.createdTime ?? '') as string,
    updatedAt: (s.updatedAt ?? s.updatedTime ?? '') as string,
    ddKillThresholdPct: toNum(s.ddKillThresholdPct),
    isKillSwitchTripped: Boolean(s.isKillSwitchTripped),
    killSwitchTrippedAt: s.killSwitchTrippedAt ?? null,
    killSwitchReason: s.killSwitchReason ?? null,
    regimeGateEnabled: Boolean(s.regimeGateEnabled),
    allowedTrendRegimes: s.allowedTrendRegimes ?? null,
    allowedVolatilityRegimes: s.allowedVolatilityRegimes ?? null,

    killSwitchGateEnabled: Boolean(s.killSwitchGateEnabled),
    correlationGateEnabled: Boolean(s.correlationGateEnabled),
    concurrentCapGateEnabled: Boolean(s.concurrentCapGateEnabled),
    kellySizingEnabled: Boolean(s.kellySizingEnabled),
    kellyMaxFraction: toNum(s.kellyMaxFraction) || 0.25,
    useRiskBasedSizing: Boolean(s.useRiskBasedSizing),
    riskPct: toNum(s.riskPct) || 0.05,

    visibility: s.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
    ownedByCurrentUser: s.ownedByCurrentUser ?? true,
    ownerLabel: s.ownerLabel ?? 'You',
  };
}

export async function getAccountStrategies(userId?: string): Promise<AccountStrategy[]> {
  const params: Record<string, string | number | boolean> = {};
  addOptionalParam(params, 'userId', userId);
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
  /** V55 — opt the new preset into risk-based LONG sizing. When omitted the
   *  backend defaults to true (new presets adopt the unified risk model). */
  useRiskBasedSizing?: boolean;
  /** V55 — per-trade risk fraction (0, 0.20]. When omitted the backend
   *  defaults to 0.05 (5%). */
  riskPct?: number;
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
  /** Risk-based sizing toggle (V55). Affects LONG entries on legacy strategies. */
  useRiskBasedSizing?: boolean;
  /** Per-trade risk fraction (0, 0.20]; used when useRiskBasedSizing=true. */
  riskPct?: number;
  /** Capital allocation % (0.01–100). Direct trade size in allocation mode;
   *  notional position cap in risk-based mode. */
  capitalAllocationPct?: number;
  /** Allow long entries. At least one of allowLong/allowShort must remain true. */
  allowLong?: boolean;
  /** Allow short entries. */
  allowShort?: boolean;
  /** V62 — kill-switch entry gate. When true, isKillSwitchTripped blocks new entries. */
  killSwitchGateEnabled?: boolean;
  /** V62 — correlation / concentration gate. */
  correlationGateEnabled?: boolean;
  /** V62 — account-level concurrent-position cap gate. */
  concurrentCapGateEnabled?: boolean;
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

/**
 * V54 — clone a (typically PUBLIC, research-agent-owned) strategy into one of
 * the calling user's accounts. Optional `targetAccountId` selects a specific
 * destination account; omitted = backend picks the user's first account.
 *
 * The clone lands as PRIVATE / disabled / simulated / STOPPED, so the user
 * must explicitly enable it before any capital is at risk. The active
 * strategy_param preset is copied alongside the row.
 *
 * Duplicate-call safety: the dialog disables the submit button while the
 * mutation is in flight (covers double-clicks). For network-retry de-dup we
 * rely on the backend's same-tuple guard, which rejects duplicate (definition
 * + symbol + interval) on the target account. The JVM has no
 * Idempotency-Key infrastructure today, so we don't pretend to send one.
 */
export async function cloneAccountStrategy(
  sourceId: string,
  targetAccountId?: string,
): Promise<{ accountStrategyId: string }> {
  const body: Record<string, string> = {};
  if (targetAccountId) body.targetAccountId = targetAccountId;
  const { data } = await apiClient.post<{ accountStrategyId: string }>(
    `/api/v1/account-strategies/${sourceId}/clone`,
    body,
  );
  return data;
}
