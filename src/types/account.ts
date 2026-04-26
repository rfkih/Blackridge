import type { ISO8601, UUID } from './api';

/** Backend AccountSummaryResponse — Java field names. */
export interface BackendAccountSummary {
  accountId: UUID;
  userId: UUID;
  username: string;
  exchange: string;
  isActive: string; // "Y" | "N"
  createdTime: ISO8601;
  /** Phase 2a — concurrency caps. */
  maxConcurrentLongs?: number | null;
  maxConcurrentShorts?: number | null;
  /** Phase 2b — vol targeting. */
  volTargetingEnabled?: boolean | null;
  bookVolTargetPct?: number | string | null;
}

/** Frontend-normalized account summary. */
export interface AccountSummary {
  id: UUID;
  userId: UUID;
  label: string;
  exchange: string;
  active: boolean;
  createdAt: ISO8601;
  /** Risk-policy levers — see Phase 2a/2b. */
  maxConcurrentLongs: number;
  maxConcurrentShorts: number;
  volTargetingEnabled: boolean;
  bookVolTargetPct: number;
}

/**
 * A handle the rest of the app uses to ask "what account am I scoped to?".
 * `'all'` means the user has asked for an aggregate view across every account.
 */
export type ActiveAccountSelection = UUID | 'all';
