import axios, { type AxiosError } from 'axios';
import { env } from '@/lib/env';

/**
 * Maps a raw API failure into a user-facing string. Prefer backend-provided
 * messages when they exist (they're usually more specific than a generic HTTP
 * code label), and fall back to the code-based mapping only when the backend
 * gave us nothing useful.
 *
 * Keep this module pure — no toast dispatches, no logging. Callers decide how
 * to surface the string.
 */

interface BackendErrorPayload {
  /** Response envelope — `{ responseCode, data, errorMessage }`. */
  errorMessage?: string;
  /** Spring default error body fields. */
  message?: string;
  error?: string;
  detail?: string;
}

export const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Bad request. Check your inputs and try again.',
  401: 'Session expired. Please log in again.',
  403: "You don't have permission to do that.",
  404: 'Resource not found.',
  409: 'Conflict — this action was already applied.',
  422: 'Invalid data. Check your inputs.',
  429: 'Too many requests. Slow down and try again.',
  500: 'Server error. Try again in a moment.',
  502: 'The API is unreachable. Try again in a moment.',
  503: 'Service temporarily unavailable.',
  504: 'The API took too long to respond.',
};

function pickBackendMessage(payload: BackendErrorPayload | null | undefined): string | null {
  if (!payload) return null;
  return payload.errorMessage || payload.message || payload.error || payload.detail || null;
}

/**
 * Humanise an unknown thrown value into a short message suitable for a toast
 * or inline banner. Defensive against non-Error throws so it never itself
 * throws (that would mask the original failure).
 */
export function normalizeError(err: unknown): string {
  if (axios.isAxiosError<BackendErrorPayload>(err)) {
    const backend = pickBackendMessage(err.response?.data);
    if (backend) return backend;

    if (err.code === 'ECONNABORTED') return 'Request timed out. Please try again.';
    if (err.code === 'ERR_NETWORK') {
      if (process.env.NODE_ENV === 'development') {
        return `Cannot reach server (${env.apiUrl}). If curl works but the browser does not, allow CORS for this origin on the API and confirm the backend is running.`;
      }
      return 'Connection failed. Check your internet.';
    }

    const status = err.response?.status;
    if (status != null && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
    if (err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return FALLBACK_MESSAGE;
}

/**
 * Resolve a raw HTTP status to a user-facing message without any request
 * context. Use from places that handle fetch errors outside of axios.
 */
export function messageForStatus(status: number): string {
  return STATUS_MESSAGES[status] ?? FALLBACK_MESSAGE;
}

/** Re-export so isAxiosError is available without pulling axios elsewhere. */
export function isAxiosError(err: unknown): err is AxiosError<BackendErrorPayload> {
  return axios.isAxiosError(err);
}
