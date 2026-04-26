import type { AccountSummary, BackendAccountSummary } from '@/types/account';
import { apiClient } from './client';

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

function toNumber(v: number | string | null | undefined, fallback: number): number {
  if (v == null) return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapAccount(a: BackendAccountSummary): AccountSummary {
  return {
    id: a.accountId,
    userId: a.userId,
    label: a.username,
    exchange: a.exchange,
    active: isAccountActive(a.isActive),
    createdAt: a.createdTime,
    maxConcurrentLongs: toNumber(a.maxConcurrentLongs, 2),
    maxConcurrentShorts: toNumber(a.maxConcurrentShorts, 2),
    volTargetingEnabled: Boolean(a.volTargetingEnabled),
    bookVolTargetPct: toNumber(a.bookVolTargetPct, 15),
  };
}

export async function getMyAccounts(): Promise<AccountSummary[]> {
  const { data } = await apiClient.get<BackendAccountSummary[]>('/api/v1/accounts');
  return data.map(mapAccount);
}

export async function getAccountById(id: string): Promise<AccountSummary> {
  const { data } = await apiClient.get<BackendAccountSummary>(`/api/v1/accounts/${id}`);
  return mapAccount(data);
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
