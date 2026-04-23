/** @type {import('next').NextConfig} */

// Parse API/WS origins from env so the CSP's connect-src allow-list matches
// exactly where the app actually talks to. Fallbacks match lib/env.ts so dev
// boots with sensible defaults.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

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
const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

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
  `connect-src 'self' ${API_URL} ${WS_URL} ${wsHttpOrigin}`,
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

const nextConfig = {
  // Hide framework disclosure from response headers.
  poweredByHeader: false,
  // Enforce strict ESLint/TS; a prod build should never ship with header config errors.
  reactStrictMode: true,

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
