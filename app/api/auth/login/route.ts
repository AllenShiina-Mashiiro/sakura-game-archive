import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import { verifyPassword, createSession, bootstrapAdmin } from '@/lib/auth';
import { randomUUID } from 'node:crypto';
export async function POST(req: Request) {
  await bootstrapAdmin();
  const b = await req.json().catch(() => null);
  if (!b || typeof b.username !== 'string' || typeof b.password !== 'string') return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
  const db = await readDb();
  const user = db.users.find((u) => u.username === b.username.trim().toLowerCase());
  if (!user || !(await verifyPassword(b.password, user.passwordHash))) return NextResponse.json({ error: '用户名或密码不正确' }, { status: 401 });
  if (user.status !== 'active') return NextResponse.json({ error: '该账户已被封禁，请联系管理员' }, { status: 403 });
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const oldLevel = levelOf(user.exp);
  if (user.lastDailyLogin !== today) {
    user.exp += 5;
    user.lastDailyLogin = today;
  }
  if (levelOf(user.exp) > oldLevel) {
    db.notifications = db.notifications || [];
    db.notifications.unshift({
      id: randomUUID(),
      userId: user.id,
      type: 'level',
      title: '等级提升啦！',
      body: `恭喜升级至 Lv.${levelOf(user.exp)}。`,
      href: `/users/${user.id}`,
      createdAt: now.toISOString(),
    });
  }
  user.lastLoginAt = now.toISOString();
  user.lastLoginIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  db.loginLogs.unshift({
    id: randomUUID(),
    userId: user.id,
    username: user.username,
    ip: user.lastLoginIp,
    date: now.toISOString(),
  });
  db.loginLogs = db.loginLogs.slice(0, 5000);
  await writeDb(db);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}

function levelOf(exp: number) {
  const thresholds = [0, 50, 120, 220, 350, 500, 680, 880, 1100, 1350, 1650, 2000, 2400, 2850, 3350, 3900, 4500, 5150, 5850, 6600, 7400, 8250, 9150, 10100, 11100, 12200, 13400, 14700, 16100, 17600];
  let level = 1;
  thresholds.forEach((n, i) => {
    if (exp >= n) level = i + 1;
  });
  return level;
}
