import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'bs_session';
const PUBLIC = ['/login', '/api/auth', '/api/rmc/import-cement'];

// Middleware only checks cookie presence + expiry (no crypto).
// Full HMAC verification happens inside each API route via auth.ts.
function hasValidSession(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const exp = parseInt(parts[1]);
    if (isNaN(exp) || Date.now() > exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some(p => pathname.startsWith(p)) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (hasValidSession(token)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
