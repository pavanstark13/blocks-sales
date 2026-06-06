import { cookies } from 'next/headers';

const SECRET  = process.env.AUTH_SECRET  || 'blocks-sales-dev-secret-change-in-prod';
const USER    = process.env.ADMIN_USER   || 'admin';
const PASS    = process.env.ADMIN_PASSWORD || 'blocks2025';
export const COOKIE  = 'bs_session';
const TTL_MS  = 7 * 24 * 60 * 60 * 1000;

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createToken(): Promise<string> {
  const exp = Date.now() + TTL_MS;
  const payload = `${USER}:${exp}`;
  const signature = await sign(payload);
  return `${payload}:${signature}`;
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    const payload = `${parts[0]}:${parts[1]}`;
    const exp = parseInt(parts[1]);
    if (isNaN(exp) || Date.now() > exp) return false;
    const expected = await sign(payload);
    return expected === parts[2];
  } catch {
    return false;
  }
}

export function checkCredentials(user: string, pass: string): boolean {
  return user === USER && pass === PASS;
}

export async function getSession(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  return verifyToken(token);
}
