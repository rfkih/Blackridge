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

  // Local dedup gate — server still dedups by fingerprint, this is a
  // courtesy to avoid spraying the network during a tight error loop.
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

  // Fire-and-forget. Use `fetch` directly to bypass the Axios interceptor
  // chain (the interceptor calls reportError on 5xx, so going through it
  // would re-enter on a failed report).
  const url = `${env.apiUrl}/api/v1/errors`;
  try {
    void fetch(url, {
      method: 'POST',
      // No credentials — endpoint is permitAll() and we want it to work
      // before login (login-page crashes are exactly the high-value reports).
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // Don't keep the network alive after page unload — a few dropped
      // reports are fine; blocking navigation is not.
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
  // The server falls back to its own SHA-256 when fingerprint is absent;
  // browser environments with subtle.crypto compute it client-side for a
  // more stable identity (URL changes shouldn't refingerprint the same bug).
  return djb2(parts.join('||'));
}

/**
 * Lightweight non-crypto hash so the client can compute fingerprints
 * synchronously without subtle.crypto's async. Server uses SHA-256 for the
 * authoritative fingerprint when the client's is absent. They don't need to
 * agree byte-for-byte: each is internally consistent for its own callers.
 * 64-hex-char output keeps the column shape compatible.
 */
function djb2(s: string): string {
  let h1 = 5381 >>> 0;
  let h2 = 52711 >>> 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) >>> 0;
    h2 = ((h2 * 33) ^ c) >>> 0;
  }
  const hex1 = h1.toString(16).padStart(8, '0');
  const hex2 = h2.toString(16).padStart(8, '0');
  // Pad to 64 hex chars (32 bytes) to fit the existing fingerprint column.
  return (hex1 + hex2).repeat(4);
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
