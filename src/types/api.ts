export type UUID = string;
export type ISO8601 = string;
export type EpochMs = number;

export interface ApiError {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, string>;
}

/**
 * Compact page envelope used by trades and backtest list endpoints — the
 * backend collapses Spring's metadata to a single `total` count instead of
 * emitting `totalElements`/`totalPages`/`number` separately. Distinct from
 * {@link PageEnvelope} below; do not conflate them.
 */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  total: number;
}

/**
 * Spring Data Page envelope shape — what every paginated backend list endpoint
 * returns when called with `?page=&size=`. `number` is the 0-based page index.
 * Treat `totalElements` as the source of truth for the unfiltered count, never
 * `content.length`.
 */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/**
 * Admin-style page envelope used by alerts, error-log, audit, support, etc. —
 * the backend echoes the requested 0-based `page` index back instead of
 * Spring's `number`, and includes both `totalElements` and `totalPages`.
 * Per-endpoint extensions (e.g. `unreadCount` on the support inbox) intersect
 * additional fields on top of this base.
 */
export interface PageEnvelope<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
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

/** Backend AccountStrategy DTO — accepts both old Java field names and the
 *  new @JsonProperty aliases added to AccountStrategyResponse. All renamed
 *  fields are optional so the mapper can fall back gracefully. */
export interface BackendAccountStrategy {
  // New wire names (from @JsonProperty on AccountStrategyResponse)
  id?: UUID | null;           // was accountStrategyId
  interval?: string | null;   // was intervalName
  status?: string | null;     // was currentStatus
  createdAt?: ISO8601 | null; // was createdTime
  updatedAt?: ISO8601 | null; // was updatedTime
  // Legacy Java field names — kept so cached/proxied responses still map
  accountStrategyId?: UUID | null;
  intervalName?: string | null;
  currentStatus?: string | null;
  createdTime?: ISO8601 | null;
  updatedTime?: ISO8601 | null;
  // Unchanged fields
  accountId: UUID;
  strategyDefinitionId?: UUID | null;
  strategyCode: string;
  /** User-facing preset label. Multiple presets can share the same strategy/symbol/interval;
   *  only one is `enabled` at a time. */
  presetName?: string | null;
  symbol: string;
  enabled: boolean; // frontend: derives `status` from this
  /** Paper-trade flag: when true the strategy emits real signals but
   *  OPEN_LONG/OPEN_SHORT are diverted to paper_trade_run. Combined with
   *  `enabled` this defines the promotion state (RESEARCH / PAPER_TRADE /
   *  PROMOTED / DEMOTED). Optional for pre-V15 cached responses. */
  simulated?: boolean | null;
  /** Fraction of the account's equity allocated to this strategy (0–100). */
  capitalAllocationPct: number | string | null;
  maxOpenPositions: number | null;
  allowLong: boolean;
  allowShort: boolean;
  priorityOrder: number;
  /** Phase 2a — drawdown kill-switch fields. Optional in the type so old
   *  cached responses without them don't fail validation. */
  ddKillThresholdPct?: number | string | null;
  isKillSwitchTripped?: boolean | null;
  killSwitchTrippedAt?: ISO8601 | null;
  killSwitchReason?: string | null;
  /** Regime gate (V43) — gate live entries on FeatureStore regime columns. */
  regimeGateEnabled?: boolean | null;
  allowedTrendRegimes?: string | null;
  allowedVolatilityRegimes?: string | null;
  /** Kelly/bankroll sizing (V45) — PSR-discounted half-Kelly multiplier. */
  kellySizingEnabled?: boolean | null;
  kellyMaxFraction?: number | string | null;
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

/** Frontend-normalised user (field names decoupled from the Java DTO). */
export interface User {
  id: UUID;
  email: string;
  name: string;
  role?: string;
  createdAt?: ISO8601;
  phoneNumber?: string | null;
  /** True once the user has confirmed their email via /verify-email. */
  emailVerified?: boolean;
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
