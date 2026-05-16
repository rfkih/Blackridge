
import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/lib/env';
import { reportError } from '@/lib/observability/errorReporter';

export { normalizeError } from './errorMap';

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
/** Alias for `apiClient`; API modules use this to declare research-JVM affinity. */
export const researchClient: AxiosInstance = apiClient;

/**
 * Ship Axios failures into the error_log pipeline. 5xx and network errors
 * (no response) are reported; 4xx is skipped because client mistakes are
 * not bugs to track. Reporting is fire-and-forget — the original promise
 * still rejects for the caller's catch block.
 */
function reportApiFailure(error: AxiosError) {
  const status = error.response?.status;
  const isNetwork = status === undefined;
  const isServer = typeof status === 'number' && status >= 500;
  if (!isNetwork && !isServer) return;

  const cfg = error.config;
  const method = cfg?.method?.toUpperCase() ?? '?';
  const path = cfg?.url ?? '(unknown url)';
  const fullUrl = cfg?.baseURL ? `${cfg.baseURL}${path}` : path;

  const fingerprint = isNetwork
    ?
      'frontendnetworkerror'.padEnd(64, '0')
    : undefined;

  reportError({
    loggerName: 'frontend.api',
    level: 'ERROR',
    message: `${method} ${path} → ${isNetwork ? 'network error' : status}: ${error.message}`,
    exceptionClass: isNetwork ? 'AxiosNetworkError' : `AxiosHttp${status}`,
    stackTrace: error.stack,
    fingerprint,
    mdc: {
      method,
      url: fullUrl,
      status: isNetwork ? 'network' : String(status),
    },
  });
}

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
 *
 * 5xx responses are also shipped to /api/v1/errors so server outages and
 * proxy failures the user actually hit show up in the error_log dashboard
 * alongside the JVM-side rows. 4xx is intentionally NOT reported — those
 * are client-mistake responses (validation, not-found, conflict) and would
 * drown the table.
 */
function sharedErrorHandler(error: AxiosError) {
  logDevAxiosFailure(error);
  reportApiFailure(error);
  if (error.response?.status === 401) {
    const { clearAuth } = useAuthStore.getState();
    clearAuth();

    if (
      typeof window !== 'undefined' &&
      !redirectingToLogin &&
      !isAuthPath(window.location.pathname)
    ) {
      redirectingToLogin = true;

      markSessionExpired();
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
  }
  return Promise.reject(error);
}
