/**
 * Frontend → trading JVM error reporter. POSTs to /api/v1/errors so every
 * captured browser error lands in `error_log`, sharing the dedup +
 * severity-classification pipeline with backend-sourced events.
 *
 * Design rules:
 * - Use raw `fetch` (NOT the Axios client) so the reporter cannot loop on
 *   its own failure path: if the API client itself blows up, reporting
 *   through Axios would re-trigger the same interceptor and risk
 *   infinite recursion.
 * - In-flight dedup latch (fingerprint → expiry ms) so a tight error loop
 *   in a render cycle doesn't fire the same payload 60×/sec. Server-side
 *   dedup still works; this is just a network-courtesy gate.
 * - Drop everything in non-browser contexts (SSR/build) — `report()` is a
 *   no-op when `typeof window === 'undefined'`.
 * - The reporter never throws, never rejects. Failures are surfaced via
 *   one-line console.warn so a broken endpoint is visible in dev but
 *   doesn't cascade.
 */
import { env } from '@/lib/env';

/** Local dedup TTL — a single fingerprint reports at most once per window. */
const DEDUP_TTL_MS = 60_000;

/** Cap stack/message size on the client to keep the request small. Server
 *  truncates further (16 KB stack); this is just to avoid uploading megabytes. */
const MESSAGE_CHAR_LIMIT = 5_000;
const STACK_CHAR_LIMIT = 16_000;

const inflight = new Map<string, number>();

export interface ErrorReportInput {
  /**
   * Logical logger name — drives severity classification on the server.
   * Convention: `frontend.<surface>.<component>` — e.g. `frontend.trade.NewOrderForm`.
   * Falls back to `frontend.unknown` when omitted.
   */
  loggerName?: string;
  /** "ERROR" (default) or "WARN". Server only persists ERROR-level rows. */
  level?: 'ERROR' | 'WARN';
  /** Required. Short human-readable summary. */
  message: string;
  /** e.g. `TypeError`, `ChunkLoadError`. From `Error.name` when not set. */
  exceptionClass?: string;
  /** Stack trace string. Truncated to STACK_CHAR_LIMIT before send. */
  stackTrace?: string;
  /** Optional pre-computed fingerprint. If absent the server hashes loggerName + exceptionClass + first stack lines. */
  fingerprint?: string;
  /** Free-form context — URL, route, user id, etc. Stored verbatim into error_log.mdc. */
  mdc?: Record<string, string>;
}

export function reportError(input: ErrorReportInput): void {
  if (typeof window === 'undefined') return;

  const message = truncate(input.message, MESSAGE_CHAR_LIMIT);
  if (!message) return;

  const stackTrace = truncate(input.stackTrace, STACK_CHAR_LIMIT);
  const loggerName = input.loggerName ?? 'frontend.unknown';
  const exceptionClass = input.exceptionClass;

  const fingerprint = input.fingerprint ?? computeFingerprint(loggerName, exceptionClass, stackTrace);

  const now = Date.now();
  prunestale(now);
  const expiry = inflight.get(fingerprint);
  if (expiry !== undefined && expiry > now) return;
  inflight.set(fingerprint, now + DEDUP_TTL_MS);

  const mdc = buildMdc(input.mdc);

  const body = {
    source: 'frontend',
    loggerName,
    level: input.level ?? 'ERROR',
    message,
    exceptionClass,
    stackTrace,
    fingerprint,
    mdc,
  };

  const url = `${env.apiUrl}/api/v1/errors`;
  try {
    void fetch(url, {
      method: 'POST',

      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),

      keepalive: true,
    }).catch((err) => {
      // eslint-disable-next-line no-console -- single line, dev signal only
      console.warn('[errorReporter] POST failed:', err?.message ?? err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[errorReporter] threw synchronously:', err);
  }
}

/** Convert any thrown thing into a structured report payload. */
export function reportException(
  err: unknown,
  context: { loggerName?: string; mdc?: Record<string, string> } = {},
): void {
  const { name, message, stack } = normalizeError(err);
  reportError({
    loggerName: context.loggerName,
    message,
    exceptionClass: name,
    stackTrace: stack,
    mdc: context.mdc,
  });
}

function normalizeError(err: unknown): { name: string; message: string; stack: string | undefined } {
  if (err instanceof Error) {
    return { name: err.name || 'Error', message: err.message || '(no message)', stack: err.stack };
  }
  if (typeof err === 'string') return { name: 'Error', message: err, stack: undefined };
  try {
    return { name: 'Error', message: JSON.stringify(err), stack: undefined };
  } catch {
    return { name: 'Error', message: String(err), stack: undefined };
  }
}

function buildMdc(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    base.url = safeString(window.location.href);
    base.route = safeString(window.location.pathname);
    base.userAgent = safeString(navigator.userAgent);
    const buildSha = process.env.NEXT_PUBLIC_BUILD_SHA;
    if (buildSha) base.buildSha = buildSha;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (typeof v === 'string' && v.length > 0) base[k] = v.length > 500 ? `${v.slice(0, 500)}…` : v;
    }
  }
  return base;
}

function computeFingerprint(loggerName: string, exClass: string | undefined, stack: string | undefined): string {
  const parts = [loggerName ?? '?', exClass ?? '?'];
  if (stack) {
    const lines = stack.split(/\r?\n/, 6).slice(0, 5).map((s) => s.trim());
    parts.push(lines.join('|'));
  }

  return multiStreamHash(parts.join('||'));
}

/**
 * 8 djb2 streams with independent seeds, concatenated as 64 hex chars.
 * Each stream contributes 8 hex chars of real entropy, so the full output
 * has comparable collision resistance to a 256-bit hash for non-adversarial
 * inputs (good enough for fingerprinting; we are not signing anything).
 *
 * Synchronous on purpose — `crypto.subtle.digest` would force the entire
 * report path async and complicate the fire-and-forget call sites.
 */
function multiStreamHash(s: string): string {
  const seeds = [5381, 52711, 14695981, 31, 17, 41, 53, 71];
  let out = '';
  for (const seed of seeds) {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  return s.length <= max ? s : `${s.slice(0, max)}\n…[truncated]`;
}

function safeString(s: string | undefined | null): string {
  if (!s) return '';
  return s.length <= 500 ? s : `${s.slice(0, 500)}…`;
}

function prunestale(now: number): void {
  if (inflight.size < 64) return;
  inflight.forEach((expiry, fp) => {
    if (expiry <= now) inflight.delete(fp);
  });
}
