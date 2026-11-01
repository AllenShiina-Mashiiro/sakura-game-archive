import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { readDb, mutateDb } from './db';
import type { User } from './types';
const scrypt = promisify(scryptCb);
const COOKIE = 'gra_session';
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET 必须设置为至少 32 位随机字符串');
  return s;
}
function sign(id: string, expires: string) {
  return createHmac('sha256', secret()).update(`${id}.${expires}`).digest('hex');
}
export async function createSession(userId: string) {
  const expires = String(Date.now() + 1000 * 60 * 60 * 24 * 14);
  const value = `${userId}.${expires}.${sign(userId, expires)}`;
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}
export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
export async function getSessionUser(): Promise<User | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [id, expires, sig] = value.split('.');
  if (!id || !expires || !sig || Number(expires) < Date.now()) return null;
  try {
    const expected = Buffer.from(sign(id, expires), 'hex'),
      actual = Buffer.from(sig, 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  } catch {
    return null;
  }
  const db = await readDb();
  const user = db.users.find((u) => u.id === id);
  return user?.status === 'active' ? user : null;
}
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') throw new Error('FORBIDDEN');
  return user;
}
export function clientUser(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}
export async function bootstrapAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 10) return;
  const passwordHash = await hashPassword(password);
  await mutateDb((fresh) => {
    if (fresh.users.some((u) => u.role === 'admin')) return;
    fresh.users.push({
      id: 'initial-admin',
      username: 'admin',
      passwordHash,
      nickname: '管理员',
      avatar: '',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      exp: 0,
      badges: ['站点管理员'],
      title: '站点管理员',
    });
  });
}
