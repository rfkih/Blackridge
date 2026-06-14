import type { AccountSummary, BackendAccountSummary } from '@/types/account';
import { DEFAULT_ACCOUNT_TYPE, isAccountType, type AccountType } from '@/types/accountType';
import { apiClient } from './client';
import { toNum, toNumOrNull } from './coerce';

/**
 * Backend stores `accounts.is_active` as a CHAR(1) flag. In prod the column
 * actually holds "1"/"0" rather than the "Y"/"N" the original schema
 * suggested, so we accept both conventions and treat only the positive
 * variants as active.
 */
function isAccountActive(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'y' || v === 'true';
}

function mapAccount(a: BackendAccountSummary): AccountSummary {
  return {
    id: a.accountId,
    userId: a.userId,
    label: a.username,
    exchange: a.exchange,
    active: isAccountActive(a.isActive),
    createdAt: a.createdTime,
    accountType: isAccountType(a.accountType) ? a.accountType : DEFAULT_ACCOUNT_TYPE,
    maxConcurrentLongs: toNum(a.maxConcurrentLongs, 2),
    maxConcurrentShorts: toNum(a.maxConcurrentShorts, 2),

    maxConcurrentTrades: toNumOrNull(a.maxConcurrentTrades),
    volTargetingEnabled: Boolean(a.volTargetingEnabled),
    bookVolTargetPct: toNum(a.bookVolTargetPct, 15),
    earnEnabled: Boolean(a.earnEnabled),
  };
}

export async function getMyAccounts(): Promise<AccountSummary[]> {
  const { data } = await apiClient.get<BackendAccountSummary[]>('/api/v1/accounts');
  return data.map(mapAccount);
}

/**
 * Payload for creating a new exchange account. Mirrors the backend's
 * `CreateAccountRequest` — the service stamps userId from the JWT and
 * defaults the risk fields server-side, so we only ask the user for the
 * identifying + credential fields.
 */
export interface CreateAccountPayload {
  username: string;
  /** Three-letter exchange code; backend stores uppercase. */
  exchange: string;
  apiKey: string;
  apiSecret: string;
  acknowledgedSafety: boolean;
  /** Account taxonomy (V153). Omit → backend defaults to TRADING. Immutable
   *  after create (absent from update/patch payloads). */
  accountType?: AccountType;
}

export async function createAccount(payload: CreateAccountPayload): Promise<AccountSummary> {
  const { data } = await apiClient.post<BackendAccountSummary>('/api/v1/accounts', payload);
  return mapAccount(data);
}

/**
 * Payload for {@link rotateAccountCredentials}. Binance API keys can't be
 * mutated in place on the exchange, so rotation is always a full key+secret
 * replacement. The backend re-encrypts both values at rest.
 */
export interface RotateAccountCredentialsPayload {
  apiKey: string;
  apiSecret: string;
}

export async function rotateAccountCredentials(
  accountId: string,
  payload: RotateAccountCredentialsPayload,
): Promise<AccountSummary> {
  const { data } = await apiClient.patch<BackendAccountSummary>(
    `/api/v1/accounts/${accountId}/credentials`,
    payload,
  );
  return mapAccount(data);
}

/**
 * Partial update for the per-account risk policy: concurrency caps + the
 * vol-targeting toggle/target. Null fields are left unchanged on the backend.
 */
export interface RiskConfigPayload {
  maxConcurrentLongs?: number;
  maxConcurrentShorts?: number;
  /**
   * Total concurrent-trade cap (1-20). Pass {@code 0} (or any value below
   * 1) to clear the cap on the backend. Omit to leave unchanged.
   */
  maxConcurrentTrades?: number;
  volTargetingEnabled?: boolean;
  bookVolTargetPct?: number;
}

export async function updateAccountRiskConfig(
  accountId: string,
  payload: RiskConfigPayload,
): Promise<AccountSummary> {
  const { data } = await apiClient.patch<BackendAccountSummary>(
    `/api/v1/accounts/${accountId}/risk-config`,
    payload,
  );
  return mapAccount(data);
}

/**
 * Toggle idle-cash Simple Earn yield for a HEDGING account (per-account opt-in).
 * Earn still requires the deploy-level master switch to actually run.
 */
export async function updateAccountEarnConfig(
  accountId: string,
  enabled: boolean,
): Promise<AccountSummary> {
  const { data } = await apiClient.patch<BackendAccountSummary>(
    `/api/v1/accounts/${accountId}/earn-config`,
    { enabled },
  );
  return mapAccount(data);
}

// ---- Account-type switch (TRADING <-> HEDGING) ----

export interface SwitchStrategyImpact {
  accountStrategyId: string;
  strategyCode: string;
  presetName: string;
  simulated: boolean;
}

export interface SwitchOpenTradeImpact {
  tradeId: string;
  accountStrategyId: string;
  asset: string;
  side: string;
}

export interface AccountTypeSwitchPreview {
  currentType: AccountType;
  targetType: AccountType;
  alreadyTargetType: boolean;
  strategiesToDisable: SwitchStrategyImpact[];
  strategiesToRestore: SwitchStrategyImpact[];
  openTradesToClose: SwitchOpenTradeImpact[];
  hasLivePositions: boolean;
}

export interface AccountTypeSwitchResult {
  accountType: AccountType;
  strategiesDisabled: number;
  tradesClosed: number;
  strategiesRestored: number;
}

/** Dry-run: what a switch to `target` would do (drives the warning dialog). No mutation. */
export async function previewAccountTypeSwitch(
  accountId: string,
  target: AccountType,
): Promise<AccountTypeSwitchPreview> {
  const { data } = await apiClient.get<AccountTypeSwitchPreview>(
    `/api/v1/accounts/${accountId}/account-type/preview`,
    { params: { target } },
  );
  return data;
}

/** Apply the switch: closes incompatible positions, disables/restores strategies, flips the type. */
export async function switchAccountType(
  accountId: string,
  accountType: AccountType,
): Promise<AccountTypeSwitchResult> {
  const { data } = await apiClient.patch<AccountTypeSwitchResult>(
    `/api/v1/accounts/${accountId}/account-type`,
    { accountType },
  );
  return data;
}
