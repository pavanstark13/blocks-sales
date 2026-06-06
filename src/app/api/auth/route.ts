import { NextRequest, NextResponse } from 'next/server';
import { checkCredentials, createToken, COOKIE } from '@/lib/auth';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

// POST /api/auth  { action:'login', user, pass }  |  { action:'logout' }
export async function POST(req: NextRequest) {
  const { action, user, pass } = await req.json();

  if (action === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 });
    return res;
  }

  if (action === 'login') {
    if (!checkCredentials(user, pass)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }
    const token = createToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, token, COOKIE_OPTS);
    return res;
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
