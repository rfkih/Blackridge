// Edge middleware — route-gates dashboard paths on the presence of the
// `blackheart-session` SIGNAL cookie written by authStore on the frontend origin.
//
// This cookie is deliberately not the real JWT — that one lives HttpOnly on
// the API origin and is never readable by middleware here (different origin).
// The signal is UX-only: spoofing it at most gets you a dashboard shell whose
// first /me call returns 401 and redirects back to /login. Real auth is
// always enforced server-side by the API.
import { NextResponse, type NextRequest } from 'next/server';

const SIGNAL_COOKIE = 'blackheart-session';
const PUBLIC_PATHS = ['/login', '/register', '/healthcheck'];

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
  // Match everything except Next internals, static files, and public auth paths.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|register|healthcheck|api/).*)'],
};
