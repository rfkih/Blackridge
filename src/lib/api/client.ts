// SLICE 1: Axios instance with bearer-token interceptor and error normalization.
import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { env } from '@/lib/env';

// Re-export the error helpers so callers that imported them from `./client`
// keep working after the lift into `./errorMap`.
export { normalizeError, messageForStatus, FALLBACK_MESSAGE } from './errorMap';

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

apiClient.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/register/')
  );
}

apiClient.interceptors.response.use(
  (response) => {
    // Unwrap the backend envelope: { responseCode, responseDesc, data, errorMessage }
    // so every caller just receives the inner `data` directly.
    if (isEnvelope(response.data)) {
      const envelope = response.data;
      if (envelope.errorMessage) {
        return Promise.reject(new Error(envelope.errorMessage));
      }
      response.data = envelope.data;
    }
    return response;
  },
  (error: AxiosError) => {
    logDevAxiosFailure(error);
    if (error.response?.status === 401) {
      const { clearAuth } = useAuthStore.getState();
      clearAuth();
      if (typeof window !== 'undefined' && !isAuthPath(window.location.pathname)) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?next=${next}`);
      }
    }
    return Promise.reject(error);
  },
);
