import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

// Parse API/WS origins from env so the CSP's connect-src allow-list matches
// exactly where the app actually talks to. Fallbacks match lib/env.ts so dev
// boots with sensible defaults.
//
// Production BUILDS are strict: NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL
// MUST be set, otherwise the prod bundle would bake a localhost CSP that
// silently blocks every API call. RESEARCH_URL stays optional in prod — when
// unset we collapse to API_URL (single-JVM deploy, per CLAUDE.md). lib/env.ts
// applies the same rule so the runtime URL and the CSP allow-list always
// agree.
//
// Strictness is keyed on the Next.js PHASE, not NODE_ENV — `next lint` also
// runs with NODE_ENV=production, and a hard-throw there breaks linting on any
// machine without deploy env vars.
const isProd = process.env.NODE_ENV === 'production';

// Server-side only (no NEXT_PUBLIC prefix — never exposed to the browser).
// Used by Next.js rewrites to forward browser API calls to the JVMs.
// In Docker compose all services share blackheart_default bridge, so the
// service names resolve. Override via env var for non-compose topologies.
const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL || (isProd ? 'http://trading:8080' : 'http://localhost:8080');
const INTERNAL_RESEARCH_URL =
  process.env.INTERNAL_RESEARCH_URL || (isProd ? 'http://research:8081' : 'http://localhost:8081');

function readEnv(name, fallback, strict) {
  const raw = process.env[name];
  if (raw && raw.trim()) return raw.trim();
  if (strict) {
    throw new Error(
      `[next.config] ${name} is required for production builds. ` +
        `Set it in the deploy environment before \`next build\`.`,
    );
  }
  return fallback;
}
/** @returns {import('next').NextConfig} */
export default function buildConfig(phase) {
  // `next lint` ALSO loads the config under PHASE_PRODUCTION_BUILD (Next 14),
  // so additionally check the CLI subcommand — linting must not require
  // deploy env vars.
  const isLintCommand = process.argv[2] === 'lint';
  const strict = phase === PHASE_PRODUCTION_BUILD && !isLintCommand;
  const API_URL = readEnv('NEXT_PUBLIC_API_URL', 'http://localhost:8080', strict);
  const WS_URL = readEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:8080/ws', strict);
  // In prod, missing RESEARCH_URL means single-JVM — collapse to API_URL.
  // In dev, fall back to the dual-JVM default so `pnpm dev` keeps working.
  const researchExplicit = process.env.NEXT_PUBLIC_RESEARCH_URL?.trim();
  const RESEARCH_URL = researchExplicit || (isProd ? API_URL : 'http://localhost:8081');

  // SockJS upgrades via XHR first, then WS — allow both schemes.
  const wsHttpOrigin = WS_URL.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');

  // CSP directives.
  //
  // `unsafe-inline` on script-src stays until we refactor the inline ThemeScript
  // to a nonce. `unsafe-eval` is allowed ONLY in dev — Next's HMR pipeline uses
  // eval() for hot reloading, and blocking it silently breaks the whole page
  // bundle (button clicks do nothing, no visible error in the UI). Production
  // bundles don't use eval, so we strip it.
  //
  // frame-ancestors 'none' = clickjacking defence (replaces X-Frame-Options).
  const scriptSrc = isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  const CSP = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    // Research JVM (Phase 1 decoupling) added to connect-src; deduped if equal to API_URL
    // (single-JVM deploys collapse the two values).
    `connect-src 'self' ${API_URL}${RESEARCH_URL !== API_URL ? ` ${RESEARCH_URL}` : ''} ${WS_URL} ${wsHttpOrigin}`,
  ].join('; ');

  const SECURITY_HEADERS = [
    { key: 'Content-Security-Policy', value: CSP },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ];

  return {
    // Hide framework disclosure from response headers.
    poweredByHeader: false,
    // Enforce strict ESLint/TS; a prod build should never ship with header config errors.
    reactStrictMode: true,

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
          destination: `${INTERNAL_RESEARCH_URL}/research-actuator/:path*`,
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
}
