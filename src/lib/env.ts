/**
 * Env vars that the frontend absolutely requires. Validated eagerly on import
 * so a misconfigured deploy surfaces at bundle-eval time rather than the first
 * API call. All NEXT_PUBLIC_* values are inlined by Next's bundler, so these
 * checks run once per browser load.
 *
 * Keep the allow-empty fallback behaviour for dev — `.env.local` may legitimately
 * be missing on a fresh checkout, and we want `pnpm dev` to still boot with a
 * loud warning rather than refuse to start.
 */

const DEFAULT_API_URL = 'http://localhost:8080';
const DEFAULT_WS_URL = 'ws://localhost:8080/ws';
// Phase 1 decoupling: research endpoints (/api/v1/backtest, /api/v1/research,
// /api/v1/montecarlo, /api/v1/historical) live on a separate JVM by default.
// Falls back to apiUrl in environments where the JVM split hasn't been
// deployed yet — single-JVM deploys keep working unchanged.
const DEFAULT_RESEARCH_URL = 'http://localhost:8081';

function read(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  if (raw) return raw;
  // Fail hard in production — a prod build with no API_URL silently talks to
  // localhost, which is rarely what anyone wants.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[env] ${name} is required in production. Set it in your deployment environment.`,
    );
  }
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console -- dev-only hint
    console.warn(`[env] ${name} missing; falling back to ${fallback}`);
  }
  return fallback;
}

/**
 * Optional env reader: returns trimmed value, or empty string when unset.
 * Used for `researchUrl`, where unset means "fall back to apiUrl" so the
 * frontend keeps working against a single-JVM deployment.
 */
function readOptional(name: string): string {
  return process.env[name]?.trim() ?? '';
}

const apiUrlResolved = read('NEXT_PUBLIC_API_URL', DEFAULT_API_URL);
const researchExplicit = readOptional('NEXT_PUBLIC_RESEARCH_URL');
// In production, require explicit research URL only if it's actually different
// from apiUrl. If the operator wants single-JVM prod, they can leave it unset
// and we'll route research traffic to the same host as trading.
const researchUrlResolved = researchExplicit
  || (process.env.NODE_ENV === 'production' ? apiUrlResolved : DEFAULT_RESEARCH_URL);

/**
 * Frozen env table. Prefer this over raw `process.env` references so every
 * call site goes through the same validation + trim logic.
 */
export const env = Object.freeze({
  apiUrl: apiUrlResolved,
  /**
   * Research-service base URL. Used by `researchClient` for backtest, research,
   * monte carlo, and historical-backfill endpoints. Defaults to localhost:8081
   * (Phase 1 decoupled JVM); falls back to apiUrl in production if unset.
   */
  researchUrl: researchUrlResolved,
  wsUrl: read('NEXT_PUBLIC_WS_URL', DEFAULT_WS_URL),
});

export type Env = typeof env;
