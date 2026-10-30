
import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
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
  const ip =
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

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

  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const oldLevel = levelOf(user.exp);

  // 每日首次登录增加 5 点经验
  if (user.lastDailyLogin !== today) {
    user.exp += 5;
    user.lastDailyLogin = today;
  }

  // 等级提升通知
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

  // 更新登录信息
  user.lastLoginAt = now.toISOString();
  user.lastLoginIp = ip;

  // 保存登录日志
  db.loginLogs.unshift({
    id: randomUUID(),
    userId: user.id,
    username: user.username,
    ip,
    date: now.toISOString(),
  });

  // 最多保留 5000 条登录日志
  db.loginLogs = db.loginLogs.slice(0, 5000);

  await writeDb(db);

  // 创建登录会话
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
