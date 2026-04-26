export type UUID = string;
export type ISO8601 = string;
export type EpochMs = number;

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, string>;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  total: number;
}

/** Standard API response envelope — every backend endpoint wraps its payload in this. */
export interface BackendApiResponse<T> {
  responseCode: string;
  responseDesc: string;
  data: T;
  errorMessage: string | null;
}

/** Backend user DTO (Java field names). */
export interface BackendUser {
  userId: UUID;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: ISO8601 | null;
  createdTime: ISO8601;
  updatedTime: ISO8601;
}

/** Inner data of the login / register response. */
export interface BackendAuthData {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: BackendUser;
}

/** Backend AccountStrategy DTO (Java field names; mirrors AccountStrategyResponse). */
export interface BackendAccountStrategy {
  accountStrategyId: UUID;
  accountId: UUID;
  strategyDefinitionId?: UUID | null;
  strategyCode: string;
  /** User-facing preset label. Multiple presets can share the same strategy/symbol/interval;
   *  only one is `enabled` at a time. */
  presetName?: string | null;
  symbol: string;
  intervalName: string; // frontend: interval
  enabled: boolean; // frontend: derives `status` from this
  currentStatus: string; // DB column is never updated by backend — do not use
  /** Fraction of the account's equity allocated to this strategy (0–100). */
  capitalAllocationPct: number | string | null;
  maxOpenPositions: number | null;
  allowLong: boolean;
  allowShort: boolean;
  priorityOrder: number;
  createdTime: ISO8601; // frontend: createdAt
  updatedTime: ISO8601; // frontend: updatedAt
  /** Phase 2a — drawdown kill-switch fields. Optional in the type so old
   *  cached responses without them don't fail validation. */
  ddKillThresholdPct?: number | string | null;
  isKillSwitchTripped?: boolean | null;
  killSwitchTrippedAt?: ISO8601 | null;
  killSwitchReason?: string | null;
}

/** Backend strategy-param response — params are nested under effectiveParams. */
export interface BackendParamResponse<T> {
  accountStrategyId: UUID;
  hasCustomParams: boolean;
  overrides: Partial<T>;
  effectiveParams: T;
  version: number;
  updatedAt: ISO8601;
}

/** Convenience aliases */
export type BackendLsrParamResponse<T> = BackendParamResponse<T>;
export type BackendVcbParamResponse<T> = BackendParamResponse<T>;

/** Frontend-normalised user (field names decoupled from the Java DTO). */
export interface User {
  id: UUID;
  email: string;
  name: string;
  role?: string;
  createdAt?: ISO8601;
  phoneNumber?: string | null;
}

export type AccountVenue = 'BINANCE_SPOT' | 'BINANCE_FUTURES';

export interface Account {
  id: UUID;
  userId: UUID;
  label: string;
  venue: AccountVenue;
  apiKeyMasked: string;
  testnet: boolean;
  createdAt: ISO8601;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  /** Optional — backend `RegisterUserRequest.phoneNumber` is nullable. */
  phoneNumber?: string;
}

export interface RegisterResponse {
  token: string;
  user: User;
}
