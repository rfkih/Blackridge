
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

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const signal = request.cookies.get(SIGNAL_COOKIE)?.value;
  if (signal) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|register|healthcheck|welcome|onboarding|pricing|product|security|strategies-overview|docs|api/).*)',
  ],
};
