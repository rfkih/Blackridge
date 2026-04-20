// SLICE 1: Axios instance with bearer-token interceptor and error normalization.
import axios, { AxiosError, type AxiosInstance } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { API_URL } from '@/lib/constants';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
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

interface BlackheartEnvelope {
  responseCode: string | number;
  responseDesc?: string;
  data: unknown;
  errorMessage?: string;
}

function isEnvelope(value: unknown): value is BlackheartEnvelope {
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
    // Unwrap the Blackheart API envelope: { responseCode, responseDesc, data, errorMessage }
    // so every caller just receives the inner `data` directly.
    if (isEnvelope(response.data)) {
      const env = response.data;
      if (env.errorMessage) {
        return Promise.reject(new Error(env.errorMessage));
      }
      response.data = env.data;
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

interface BackendErrorPayload {
  errorMessage?: string; // Blackheart envelope
  message?: string;
  error?: string;
  detail?: string;
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

export function normalizeError(err: unknown): string {
  if (axios.isAxiosError<BackendErrorPayload>(err)) {
    const data = err.response?.data;
    if (data?.errorMessage) return data.errorMessage;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (data?.detail) return data.detail;
    if (err.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (err.code === 'ERR_NETWORK') {
      if (process.env.NODE_ENV === 'development') {
        return `Cannot reach server (${API_URL}). If curl works but the browser does not, allow CORS for this origin (e.g. http://localhost:3000) on the API. Also confirm the backend is running.`;
      }
      return 'Cannot reach server. Check your connection.';
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return FALLBACK_MESSAGE;
}
