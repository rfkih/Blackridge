// SLICE 1: Edge middleware — gate dashboard routes on the blackheart-token cookie (mirrored from authStore).
import { NextResponse, type NextRequest } from 'next/server';

const TOKEN_COOKIE = 'blackheart-token';
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

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (token) {
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
