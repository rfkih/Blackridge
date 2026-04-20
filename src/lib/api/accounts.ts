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

function mapAccount(a: BackendAccountSummary): AccountSummary {
  return {
    id: a.accountId,
    userId: a.userId,
    label: a.username,
    exchange: a.exchange,
    active: isAccountActive(a.isActive),
    createdAt: a.createdTime,
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
