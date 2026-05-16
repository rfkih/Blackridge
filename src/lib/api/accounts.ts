import type { AccountSummary, BackendAccountSummary } from '@/types/account';
import { apiClient } from './client';
import { toNum } from './coerce';

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
    maxConcurrentLongs: toNum(a.maxConcurrentLongs, 2),
    maxConcurrentShorts: toNum(a.maxConcurrentShorts, 2),

    maxConcurrentTrades: a.maxConcurrentTrades == null ? null : Number(a.maxConcurrentTrades),
    volTargetingEnabled: Boolean(a.volTargetingEnabled),
    bookVolTargetPct: toNum(a.bookVolTargetPct, 15),
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
 * Partial update for an account's label and/or exchange. Both fields are
 * optional — null means "leave unchanged" on the backend. Credentials rotate
 * through {@link rotateAccountCredentials}, never here.
 */
export interface UpdateAccountPayload {
  /** New label (2–50 chars; letters/digits/spaces/_/- only). */
  username?: string;
  /** Three-letter exchange code; backend stores uppercase. */
  exchange?: string;
}

export async function updateAccount(
  accountId: string,
  payload: UpdateAccountPayload,
): Promise<AccountSummary> {
  const { data } = await apiClient.patch<BackendAccountSummary>(
    `/api/v1/accounts/${accountId}`,
    payload,
  );
  return mapAccount(data);
}

/**
 * Soft-delete the account. Backend rejects (4xx) when any OPEN /
 * PARTIALLY_CLOSED trades reference it; historical rows continue to resolve
 * the account by id.
 */
export async function deleteAccount(accountId: string): Promise<void> {
  await apiClient.delete(`/api/v1/accounts/${accountId}`);
}
