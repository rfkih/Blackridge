/** @type {import('next').NextConfig} */

// The CSP (incl. its connect-src API/WS allow-list and a per-request script
// nonce) is built in src/middleware.ts. Here we only keep a build-time guard
// (see requireProdEnv below) so prod fails fast when those origins are missing.
//
// Production is strict: NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL MUST be set,
// otherwise middleware would bake a localhost connect-src and silently block
// every API call. RESEARCH_URL stays optional in prod — when unset middleware
// collapses it to API_URL (single-JVM deploy, per CLAUDE.md). lib/env.ts applies
// the same rule so the runtime URL and the CSP allow-list always agree.
const isProd = process.env.NODE_ENV === 'production';

// Server-side only (no NEXT_PUBLIC prefix — never exposed to the browser).
// Used by Next.js rewrites to forward browser API calls to the trading JVM.
// In Docker compose all services share blackheart_default bridge, so the
// service name resolves. Override via env var for non-compose topologies.
//
// Every rewrite targets the trading JVM, including /research-actuator/**:
// its ResearchProxyController strips that prefix and forwards to the
// loopback-only research JVM (single security perimeter). Pointing the
// rewrite straight at research:8081 404s — the research JVM has no
// /research-actuator handler (the proxy bean is @Profile("!research")),
// which made the dashboard render a healthy research JVM as UNREACHABLE.
const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL || (isProd ? 'http://trading:8080' : 'http://localhost:8080');

function requireProdEnv(name, fallback) {
  const raw = process.env[name];
  if (raw && raw.trim()) return raw.trim();
  if (isProd) {
    throw new Error(
      `[next.config] ${name} is required for production builds. ` +
        `Set it in the deploy environment before \`next build\`.`,
    );
  }
  return fallback;
}
// Content-Security-Policy is NOT set here. It moved to src/middleware.ts so it
// can carry a per-request script nonce and drop 'unsafe-inline' from script-src
// in production. These bare calls keep the build-time guard: a prod build still
// fails fast if the browser-facing origins the CSP's connect-src depends on are
// missing (otherwise middleware would silently bake a localhost allow-list and
// block every API call in prod).
requireProdEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080');
requireProdEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:8080/ws');

// frame-ancestors 'none' (clickjacking defence) now lives in the middleware CSP.
const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig = {
  // Hide framework disclosure from response headers.
  poweredByHeader: false,
  // Enforce strict ESLint/TS; a prod build should never ship with header config errors.
  reactStrictMode: true,

  experimental: {
    // Tree-shake big named-export packages at the import level — keeps unused
    // lucide icons / recharts / date-fns modules out of page chunks.
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
  },

  // Proxy API + actuator calls to the JVMs. In production the browser sends
  // all requests to the Tailscale URL (NEXT_PUBLIC_API_URL); these rewrites
  // forward them server-side to the actual JVM containers via Docker DNS.
  // WebSocket (/ws) is NOT covered here — WS proxying requires a separate
  // reverse proxy (caddy/nginx) ahead of Next.js.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${INTERNAL_API_URL}/api/:path*`,
      },
      {
        source: '/actuator/:path*',
        destination: `${INTERNAL_API_URL}/actuator/:path*`,
      },
      {
        source: '/research-actuator/:path*',
        destination: `${INTERNAL_API_URL}/research-actuator/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
