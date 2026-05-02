// SLICE 1: Axios instances + error normalization.
//
// Single public client after V14 (2026-04-30). The research JVM is now
// internal-only (binds to 127.0.0.1:8081); the trading JVM exposes a
// reverse-proxy at /api/v1/{backtest,research,montecarlo,historical}/**
// and /research-actuator/** that forwards to it (ResearchProxyController).
// Both clients therefore share the same baseURL — `researchClient` is
// retained as an export so the per-module assignment in CLAUDE.md keeps
// working without a sweeping rename. New code can use either; both
// resolve to `env.apiUrl`.
//
// Auth model: HttpOnly `blackheart-token` cookie set by the backend on
// /login. The trading JVM validates the cookie before forwarding to the
// research JVM, which re-validates using the shared JWT_SECRET.
//
// Authentication rides entirely on the HttpOnly cookie. No in-memory
// Authorization header is attached — the browser sends the cookie
// automatically via `withCredentials: true`. Removing the Bearer fallback
// is deliberate: a JS-readable token in Zustand would be liftable by any
// XSS payload, and the cookie path covers every reachable browser
// environment.
import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/lib/env';

// Re-export the error helpers so callers that imported them from `./client`
// keep working after the lift into `./errorMap`.
export { normalizeError, messageForStatus, FALLBACK_MESSAGE } from './errorMap';

/**
 * Axios instance factory. Both clients share identical config + interceptors;
 * only the `baseURL` differs. Keeping a single factory means cookie auth,
 * envelope unwrapping, 401-handling, and dev logging stay in lockstep
 * across the two JVMs.
 */
function createApiClient(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20_000,
    withCredentials: true,
  });

  instance.interceptors.request.use((config) => {
    // Safety belt — if a request URL resolves outside our known API
    // origin, refuse to send credentials. `withCredentials: true` scopes
    // the cookie to the target origin via browser SOP already, but this
    // guards against a misconfigured caller passing a full
    // https://attacker.example URL through the client.
    const rawUrl = config.url ?? '';
    const isAbsolute = /^https?:/i.test(rawUrl);
    if (isAbsolute && !rawUrl.startsWith(env.apiUrl)) {
      config.withCredentials = false;
      if (config.headers) delete config.headers.Authorization;
    }
    return config;
  });

  instance.interceptors.response.use(envelopeUnwrapResponseHandler, sharedErrorHandler);
  return instance;
}

export const apiClient: AxiosInstance = createApiClient(env.apiUrl);
/**
 * Research-service axios client. Kept as a separate export for backwards
 * compatibility with the per-module assignment documented in CLAUDE.md;
 * after V14 (2026-04-30) it points at the same trading-JVM origin and the
 * trading JVM reverse-proxies /api/v1/{backtest,research,montecarlo,
 * historical}/** into the internal research JVM.
 */
export const researchClient: AxiosInstance = apiClient;

function logDevAxiosFailure(error: AxiosError) {
  if (process.env.NODE_ENV !== 'development') return;
  const cfg = error.config;
  const method = cfg?.method?.toUpperCase() ?? '?';
  const fullUrl =
    cfg?.baseURL != null && cfg?.url != null
      ? `${cfg.baseURL}${cfg.url}`
      : (cfg?.url ?? '(unknown url)');
  const status = error.response?.status ?? '(no response)';

  // eslint-disable-next-line no-console -- intentional dev-only API trace (Spring-style)
  console.groupCollapsed(`[api] ${status} ${method} ${fullUrl}`);
  // eslint-disable-next-line no-console
  console.error('message:', error.message);
  if (error.stack) {
    // eslint-disable-next-line no-console
    console.error('stack:\n', error.stack);
  }
  if (error.response) {
    // eslint-disable-next-line no-console
    console.error('response.data:', error.response.data);
  }
  if (cfg?.data != null) {
    // eslint-disable-next-line no-console
    console.error('request body (config.data):', cfg.data);
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

interface ApiEnvelope {
  responseCode: string | number;
  responseDesc?: string;
  data: unknown;
  errorMessage?: string;
}

function isEnvelope(value: unknown): value is ApiEnvelope {
  return typeof value === 'object' && value !== null && 'responseCode' in value && 'data' in value;
}

function isAuthPath(pathname: string): boolean {
  // Exact match or trailing slash — `/login-foo` should NOT count as the auth path.
  // Keep this list in sync with PUBLIC_PATHS in middleware.ts and the
  // permitAll() rules in SecurityConfig.java.
  const PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
  for (const p of PATHS) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

/**
 * Session-storage flag that survives the hard redirect to /login. The login
 * page reads it on mount, shows a toast, and clears it. We use sessionStorage
 * (not a query param or cookie) so the URL stays clean and the signal is
 * scoped to the current tab.
 */
const SESSION_EXPIRED_FLAG = 'blackheart:session-expired';

function markSessionExpired() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1');
  } catch {
    // sessionStorage can be unavailable in private-browsing edge cases —
    // failing silently is fine, the user just won't see the toast.
  }
}

export function consumeSessionExpiredFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const present = window.sessionStorage.getItem(SESSION_EXPIRED_FLAG) === '1';
    if (present) window.sessionStorage.removeItem(SESSION_EXPIRED_FLAG);
    return present;
  } catch {
    return false;
  }
}

// Module-level latch — the dashboard fires many queries in parallel on mount,
// and every single one returns 401 when the JWT cookie has expired. Without
// this guard each one calls `window.location.assign(...)`, producing a storm
// of navigations to /login?next=/... that looks like a redirect loop (and
// flashes the PageLoader between each).
let redirectingToLogin = false;

/**
 * Response interceptor: unwrap the backend envelope so callers receive the
 * inner `data` directly. Identical for both apiClient and researchClient.
 */
function envelopeUnwrapResponseHandler(response: import('axios').AxiosResponse) {
  if (isEnvelope(response.data)) {
    const envelope = response.data;
    if (envelope.errorMessage) {
      return Promise.reject(new Error(envelope.errorMessage));
    }
    response.data = envelope.data;
  }
  return response;
}

/**
 * Shared error handler: 401 → clear auth + redirect to /login. The
 * `redirectingToLogin` latch is module-level so a 401 from EITHER client
 * cannot trigger a redirect storm if the other client is also retrying.
 */
function sharedErrorHandler(error: AxiosError) {
  logDevAxiosFailure(error);
  if (error.response?.status === 401) {
    // Clear local auth state on every 401 — cheap and idempotent, and
    // critically: it clears the `blackheart-session` signal cookie so Next
    // middleware bounces the next navigation at the edge instead of letting
    // more API calls through.
    const { clearAuth } = useAuthStore.getState();
    clearAuth();

    if (
      typeof window !== 'undefined' &&
      !redirectingToLogin &&
      !isAuthPath(window.location.pathname)
    ) {
      redirectingToLogin = true;
      // Stash a one-shot flag so the login page can show "Your session
      // expired — please sign in again" instead of looking like the user
      // arrived for no reason.
      markSessionExpired();
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
  }
  return Promise.reject(error);
}
