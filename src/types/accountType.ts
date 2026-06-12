/**
 * Account-type taxonomy (V153). Every account is exactly one type:
 *   TRADING  — entry/exit directional position strategies (today's behavior).
 *   HEDGING  — spot allocation/tilt strategies (`dynamic_tilt`, trend, …).
 *
 * Strategy rows carry the same union under `strategyKind` (kept as a distinct
 * field from the account's `accountType` — see types/strategy.ts). Bind-time
 * enforcement on the backend rejects a strategy whose kind ≠ the account type.
 *
 * Legacy rows (pre-V153) omit the field on the wire; mappers default to
 * {@link DEFAULT_ACCOUNT_TYPE} so existing TRADING users see zero change.
 */
export type AccountType = 'TRADING' | 'HEDGING';

export const ACCOUNT_TYPES: AccountType[] = ['TRADING', 'HEDGING'];

export const DEFAULT_ACCOUNT_TYPE: AccountType = 'TRADING';

export const isAccountType = (v: unknown): v is AccountType => v === 'TRADING' || v === 'HEDGING';
