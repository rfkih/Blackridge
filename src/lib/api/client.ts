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

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const { clearAuth } = useAuthStore.getState();
      clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?next=${next}`);
      }
    }
    return Promise.reject(error);
  },
);

interface BackendErrorPayload {
  message?: string;
  error?: string;
  detail?: string;
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

export function normalizeError(err: unknown): string {
  if (axios.isAxiosError<BackendErrorPayload>(err)) {
    const data = err.response?.data;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (data?.detail) return data.detail;
    if (err.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (err.code === 'ERR_NETWORK') return 'Cannot reach server. Check your connection.';
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return FALLBACK_MESSAGE;
}
