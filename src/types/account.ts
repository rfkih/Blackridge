import type { ISO8601, UUID } from './api';

/** Backend AccountSummaryResponse — Java field names. */
export interface BackendAccountSummary {
  accountId: UUID;
  userId: UUID;
  username: string;
  exchange: string;
  isActive: string; // "Y" | "N"
  createdTime: ISO8601;
}

/** Frontend-normalized account summary. */
export interface AccountSummary {
  id: UUID;
  userId: UUID;
  label: string;
  exchange: string;
  active: boolean;
  createdAt: ISO8601;
}

/**
 * A handle the rest of the app uses to ask "what account am I scoped to?".
 * `'all'` means the user has asked for an aggregate view across every account.
 */
export type ActiveAccountSelection = UUID | 'all';
