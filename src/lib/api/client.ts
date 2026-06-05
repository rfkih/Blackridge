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
    // Origin-safety belt: only the two known JVM origins are trusted with the
    // auth cookie. researchUrl is included so the research client keeps
    // credentials in a split-JVM deploy (it equals apiUrl in single-JVM prod).
    const trustedOrigins = [env.apiUrl, env.researchUrl];
    if (isAbsolute && !trustedOrigins.some((origin) => rawUrl.startsWith(origin))) {
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
 * Research-JVM client. Uses {@link env.researchUrl} — which falls back to
 * apiUrl when NEXT_PUBLIC_RESEARCH_URL is unset (single-JVM prod) — so
 * research / backtest / montecarlo / historical traffic reaches the research
 * JVM in a split deploy instead of silently hitting the trading JVM. Reuses
 * the apiClient instance when the two origins are identical.
 */
export const researchClient: AxiosInstance =
  env.researchUrl === env.apiUrl ? apiClient : createApiClient(env.researchUrl);

/**
 * One-shot boot diagnostic for the localhost↔127.0.0.1 footgun
 * (2026-05-23). When {@code NEXT_PUBLIC_API_URL} resolves to a
 * hostname different from the page's own hostname, the browser
 * treats them as different sites under SameSite=Lax — the JWT cookie
 * the backend sets is then NOT sent on the AJAX call that triggers
 * the auth check, and the operator sees an immediate redirect back
 * to /login after a successful login.
 *
 * <p>This check runs once at module load on the client (Next inlines
 * apiClient into shared chunks). Dev-only — production deployments
 * are expected to terminate both the frontend and the API on the
 * same origin via reverse proxy, so the check would mostly false-
 * positive there.
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  try {
    const apiHost = new URL(env.apiUrl).hostname;
    const pageHost = window.location.hostname;
    if (apiHost !== pageHost) {
      // eslint-disable-next-line no-console -- intentional dev-only auth-config warning
      console.warn(
        `[auth] NEXT_PUBLIC_API_URL host "${apiHost}" differs from page host "${pageHost}". ` +
          `Browsers treat these as different sites under SameSite=Lax — the auth cookie ` +
          `the backend sets on a login response to "${apiHost}" will NOT be sent on ` +
          `subsequent AJAX from "${pageHost}", and you'll be bounced back to /login. ` +
          `Standardize: visit the dashboard at http://${apiHost}:3000 (or set ` +
          `NEXT_PUBLIC_API_URL=http://${pageHost}:8080).`,
      );
    }
  } catch {
    /* env.apiUrl wasn't a valid URL — env.ts would have caught the empty case;
       a malformed value is the operator's problem to surface another way. */
  }
}

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

  const fingerprint = isNetwork ? 'frontendnetworkerror'.padEnd(64, '0') : undefined;

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
  } catch {}
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
    logAuthWipeDiagnostic(error);
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

/**
 * Dev-mode diagnostic for the "I just logged in and got immediately
 * bounced back to /login" footgun. The browser doesn't tell us why
 * the JWT cookie wasn't honoured (HttpOnly, can't inspect from JS),
 * but we can surface enough surrounding state to point the next
 * iteration at the right thing:
 *
 * - WHICH endpoint 401'd (e.g. {@code /api/v1/users/me} on first page
 *   load after login indicates the auth cookie isn't being sent).
 * - WHETHER the signal cookie ({@code blackheart-session}) was even
 *   set — if not, the login response handler didn't run to completion.
 * - WHETHER the API host matches the page host — the cross-origin
 *   variant ({@code localhost} vs {@code 127.0.0.1}) is the #1 cause
 *   of "cookies are set but not sent" on local dev.
 *
 * Prod builds skip the console output to keep the log clean.
 */
function logAuthWipeDiagnostic(error: AxiosError) {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof window === 'undefined') return;
  const cfg = error.config;
  const method = cfg?.method?.toUpperCase() ?? '?';
  const url = cfg?.url ?? '(unknown)';
  const baseURL = cfg?.baseURL ?? '(unknown)';
  const signalCookiePresent =
    typeof document !== 'undefined' && document.cookie.includes('blackheart-session=');
  let apiHost = '(unparseable)';
  try {
    apiHost = new URL(baseURL).hostname;
  } catch {
    /* keep default */
  }
  const pageHost = window.location.hostname;
  const originMismatch = apiHost !== '(unparseable)' && apiHost !== pageHost;
  // eslint-disable-next-line no-console -- intentional auth-flow diagnostic
  console.error('[auth] 401 wiped session — investigating the bounce-to-login loop?', {
    failingRequest: `${method} ${baseURL}${url}`,
    signalCookiePresent,
    apiHost,
    pageHost,
    originMismatch,
    hint: originMismatch
      ? `API host "${apiHost}" differs from page host "${pageHost}". Cookies set on one are NOT sent on requests to the other (different sites under SameSite=Lax). Standardize NEXT_PUBLIC_API_URL and the URL you're visiting on the SAME hostname (both "localhost" or both "127.0.0.1").`
      : !signalCookiePresent
        ? 'Signal cookie is absent — the login response either failed or its handler never ran. Check the network tab for the login POST itself.'
        : 'Signal cookie present but server rejected the JWT. Most likely: JWT_SECRET rotated since this cookie was issued (clear the blackheart-token cookie and try again), or the JWT genuinely expired.',
  });
}
