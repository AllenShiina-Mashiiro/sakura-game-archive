
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/postgres';
import { users, loginLogs, notifications } from '@/drizzle/schema';
import {
  verifyPassword,
  createSession,
  bootstrapAdmin,
} from '@/lib/auth';
import { randomUUID } from 'node:crypto';
import {
  isLoginBlocked,
  recordLoginFailure,
  clearLoginFailures,
} from '@/lib/login-rate-limit';

export async function POST(req: Request) {
  // 获取客户端 IP
  // 使用常见反向代理转发的客户端 IP 请求头，避免依赖特定部署平台。
  const rawIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const ip = rawIp.replace(/[^0-9a-fA-F:.]/g, '').slice(0, 64) || 'unknown';

  // 检查是否超过登录失败次数限制
  if (await isLoginBlocked(ip)) {
    return NextResponse.json(
      { error: '登录尝试次数过多，请15分钟后再试' },
      { status: 429 }
    );
  }

  await bootstrapAdmin();

  const b = await req.json().catch(() => null);

  if (
    !b ||
    typeof b.username !== 'string' ||
    typeof b.password !== 'string' ||
    !/^[a-z0-9_]{3,24}$/i.test(b.username.trim()) ||
    b.password.length < 1 ||
    b.password.length > 128
  ) {
    return NextResponse.json(
      { error: '请输入有效的用户名和密码（用户名 3-24 位，密码不超过 128 位）' },
      { status: 400 }
    );
  }

  const [userRow] = await db.select().from(users).where(eq(users.username, b.username.trim().toLowerCase())).limit(1);
  const user = userRow ? {
    ...userRow,
    passwordHash: userRow.passwordHash ?? "",
  } : null;

  if (!user || !user.passwordHash || !(await verifyPassword(b.password, user.passwordHash))) {
    await recordLoginFailure(ip);
    return NextResponse.json({ error: '用户名或密码不正确' }, { status: 401 });
  }
  if (user.status !== 'active') {
    return NextResponse.json({ error: '该账户已被封禁，请联系管理员' }, { status: 403 });
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
    await tx.insert(loginLogs).values({
      id: randomUUID(), userId: user.id, username: user.username, ip, date: now,
    });
    if (levelOf(nextExp) > oldLevel) {
      await tx.insert(notifications).values({
        id: randomUUID(), userId: user.id, type: 'level',
        title: '等级提升啦！', body: `恭喜升级至 Lv.${levelOf(nextExp)}。`,
        href: `/users/${user.id}`, createdAt: now,
      });
    }
  });

  await createSession(user.id);

  return NextResponse.json({ ok: true });
}

function levelOf(exp: number) {
  const thresholds = [
    0, 50, 120, 220, 350, 500, 680, 880, 1100, 1350,
    1650, 2000, 2400, 2850, 3350, 3900, 4500, 5150,
    5850, 6600, 7400, 8250, 9150, 10100, 11100, 12200,
    13400, 14700, 16100, 17600,
  ];

  let level = 1;

  thresholds.forEach((n, i) => {
    if (exp >= n) {
      level = i + 1;
    }
  });

  return level;
}
