
import { NextResponse } from 'next/server';
import { readDb, mutateDb } from '@/lib/db';
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
    typeof b.password !== 'string'
  ) {
    return NextResponse.json(
      { error: '请输入用户名和密码' },
      { status: 400 }
    );
  }

  const db = await readDb();

  const user = db.users.find(
    (u) => u.username === b.username.trim().toLowerCase()
  );

  // 用户名或密码错误，记录一次失败
  if (!user || !(await verifyPassword(b.password, user.passwordHash))) {
    await recordLoginFailure(ip);

    return NextResponse.json(
      { error: '用户名或密码不正确' },
      { status: 401 }
    );
  }

  // 检查账号状态
  if (user.status !== 'active') {
    return NextResponse.json(
      { error: '该账户已被封禁，请联系管理员' },
      { status: 403 }
    );
  }

  // 登录成功，清除该 IP 的失败次数
  await clearLoginFailures(ip);

  const loginResult = await mutateDb((fresh) => {
    const current = fresh.users.find((u) => u.id === user.id);
    if (!current || current.status !== 'active' || current.passwordHash !== user.passwordHash) {
      return { ok: false as const, error: '账户状态已变化，请重新登录' };
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const oldLevel = levelOf(current.exp);

    // 每日首次登录奖励和登录日志在同一次原子快照更新中完成。
    if (current.lastDailyLogin !== today) {
      current.exp += 5;
      current.lastDailyLogin = today;
    }

    if (levelOf(current.exp) > oldLevel) {
      fresh.notifications = fresh.notifications || [];
      fresh.notifications.unshift({
        id: randomUUID(),
        userId: current.id,
        type: 'level',
        title: '等级提升啦！',
        body: `恭喜升级至 Lv.${levelOf(current.exp)}。`,
        href: `/users/${current.id}`,
        createdAt: now.toISOString(),
      });
    }

    current.lastLoginAt = now.toISOString();
    current.lastLoginIp = ip;
    fresh.loginLogs = fresh.loginLogs || [];
    fresh.loginLogs.unshift({
      id: randomUUID(),
      userId: current.id,
      username: current.username,
      ip,
      date: now.toISOString(),
    });
    fresh.loginLogs = fresh.loginLogs.slice(0, 5000);
    return { ok: true as const };
  });

  if (!loginResult.ok) {
    return NextResponse.json({ error: loginResult.error }, { status: 409 });
  }

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
