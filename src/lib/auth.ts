import { createHmac } from 'crypto';
import { cookies } from 'next/headers';

const SECRET  = process.env.AUTH_SECRET  || 'blocks-sales-dev-secret-change-in-prod';
const USER    = process.env.ADMIN_USER   || 'admin';
const PASS    = process.env.ADMIN_PASSWORD || 'blocks2025';
const COOKIE  = 'bs_session';
const TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

function sign(payload: string) {
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function createToken(): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${USER}:${exp}`;
  return `${payload}:${sign(payload)}`;
}

export function verifyToken(token: string): boolean {
  const parts = token.split(':');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}:${parts[1]}`;
  const exp = parseInt(parts[1]);
  if (isNaN(exp) || Date.now() > exp) return false;
  return sign(payload) === parts[2];
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

export { COOKIE };
