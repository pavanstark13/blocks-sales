import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'bs_session';
const PUBLIC = ['/login', '/api/auth'];

// Edge-compatible HMAC-SHA256 verify (Web Crypto API)
async function verifyToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const payload = `${parts[0]}:${parts[1]}`;
    const exp = parseInt(parts[1]);
    if (isNaN(exp) || Date.now() > exp) return false;

    const secret = process.env.AUTH_SECRET || 'blocks-sales-dev-secret-change-in-prod';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return expected === parts[2];
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some(p => pathname.startsWith(p)) || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (token && await verifyToken(token)) {
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
