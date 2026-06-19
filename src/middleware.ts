import { NextResponse, type NextRequest } from 'next/server';

const SIGNAL_COOKIE = 'blackheart-session';
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/healthcheck',
  '/privacy',
  '/terms',
  '/cookies',
  '/welcome',
  '/onboarding',
  '/pricing',
  '/product',
  '/security',
  '/strategies-overview',
  '/docs',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  );
}

/**
 * Per-request, unguessable base64 nonce. Edge runtime exposes Web Crypto +
 * btoa globally. A fresh value every request is what lets the CSP drop
 * `'unsafe-inline'` from script-src: only scripts carrying THIS nonce run.
 */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Build the CSP for this response. Mirrors the connect-src allow-list that used
 * to live in next.config.mjs (kept here because the script nonce is per-request,
 * which a static config header cannot express).
 *
 * Prod: `script-src 'self' 'nonce-<n>'` — NO 'unsafe-inline'. Next.js auto-adds
 * the nonce to its own streaming/bootstrap scripts because it sees this header on
 * the request; our inline ThemeScript gets it via the x-nonce request header.
 * Dev: keep 'unsafe-inline'/'unsafe-eval' so HMR (which eval()s) keeps working.
 */
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === 'production';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
  const researchExplicit = process.env.NEXT_PUBLIC_RESEARCH_URL?.trim();
  const researchUrl = researchExplicit || (isProd ? apiUrl : 'http://localhost:8081');
  // SockJS upgrades via XHR first, then WS — allow both schemes.
  const wsHttpOrigin = wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');

  const scriptSrc = isProd
    ? `script-src 'self' 'nonce-${nonce}'`
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // style-src keeps 'unsafe-inline': nonces don't cover inline `style=` attributes,
    // which Radix/Recharts/lightweight-charts set at runtime.
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    `connect-src 'self' ${apiUrl}${researchUrl !== apiUrl ? ` ${researchUrl}` : ''} ${wsUrl} ${wsHttpOrigin}`,
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Auth gate (unchanged): bounce unauthenticated access to protected pages.
  if (!isPublicPath(pathname)) {
    const signal = request.cookies.get(SIGNAL_COOKIE)?.value;
    if (!signal) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.search = '';
      loginUrl.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Set the CSP (and nonce) on the REQUEST headers so Next.js nonces the scripts
  // it injects; mirror the CSP onto the RESPONSE so the browser enforces it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // Run on every document route so the CSP is applied everywhere (public pages
  // included). Skip API proxy paths and static assets. The isPublicPath() gate
  // above still decides auth, so broadening the matcher doesn't change auth flow.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
