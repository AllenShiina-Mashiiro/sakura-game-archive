import { NextResponse } from 'next/server';
import { and, eq, or } from 'drizzle-orm';
import { db } from '@/lib/postgres';
import { users, loginLogs, notifications } from '@/drizzle/schema';
import { verifyPassword, createSession, bootstrapAdmin } from '@/lib/auth';
import { randomUUID } from 'node:crypto';
import { isLoginBlocked, recordLoginFailure, clearLoginFailures } from '@/lib/login-rate-limit';

export async function POST(req: Request) {
  const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip') || 'unknown';
  const ip = rawIp.replace(/[^0-9a-fA-F:.]/g, '').slice(0, 64) || 'unknown';

  if (await isLoginBlocked(ip)) {
    return NextResponse.json({ error: '登录尝试次数过多，请15分钟后再试' }, { status: 429 });
  }

  await bootstrapAdmin();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string'
    || body.username.trim().length > 320 || body.password.length < 1 || body.password.length > 128) {
    return NextResponse.json({ error: '请输入有效的 ID / 邮箱和密码' }, { status: 400 });
  }

  const identifier = body.username.trim().toLowerCase().replace(/^@/, '');
  const [user] = await db.select().from(users)
    .where(or(eq(users.username, identifier), eq(users.email, identifier))).limit(1);

  if (!user || !user.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
    await recordLoginFailure(ip);
    return NextResponse.json({ error: 'ID、邮箱或密码不正确' }, { status: 401 });
  }
  if (user.status !== 'active') {
    return NextResponse.json({ error: '该账户已被封禁，请联系管理员' }, { status: 403 });
  }
  if (!user.emailVerifiedAt) {
    return NextResponse.json({ error: '该账户邮箱尚未验证，请完成邮箱验证' }, { status: 403 });
  }
  await clearLoginFailures(ip);

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const oldLevel = levelOf(user.exp);
  const dailyReward = user.lastDailyLogin !== today;
  const nextExp = user.exp + (dailyReward ? 5 : 0);

  await db.transaction(async (tx) => {
    await tx.update(users).set({
      exp: nextExp,
      lastDailyLogin: dailyReward ? today : user.lastDailyLogin,
      lastLoginAt: now,
      lastLoginIp: ip,
      updatedAt: now,
    }).where(and(eq(users.id, user.id), eq(users.status, 'active')));
    await tx.insert(loginLogs).values({ id: randomUUID(), userId: user.id, username: user.username, ip, date: now });
    if (levelOf(nextExp) > oldLevel) {
      await tx.insert(notifications).values({
        id: randomUUID(), userId: user.id, type: 'level',
        title: '等级提升啦！', body: `恭喜升级至 Lv.${levelOf(nextExp)}。`,
        href: `/users/${user.username}`, createdAt: now,
      });
    }
  });

  await createSession(user.id);
  return NextResponse.json({ ok: true, username: user.username });
}

function levelOf(exp: number) {
  const thresholds = [0,50,120,220,350,500,680,880,1100,1350,1650,2000,2400,2850,3350,3900,4500,5150,5850,6600,7400,8250,9150,10100,11100,12200,13400,14700,16100,17600];
  let level = 1;
  thresholds.forEach((threshold, index) => { if (exp >= threshold) level = index + 1; });
  return level;
}
