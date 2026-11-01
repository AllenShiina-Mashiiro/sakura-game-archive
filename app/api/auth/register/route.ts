import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { mutateDb } from '@/lib/db';
import { hashPassword, createSession, bootstrapAdmin } from '@/lib/auth';
export async function POST(req: Request) {
  await bootstrapAdmin();
  const b = await req.json().catch(() => null);
  if (!b || typeof b.username !== 'string' || typeof b.password !== 'string' || typeof b.nickname !== 'string') return NextResponse.json({ error: '注册信息不完整' }, { status: 400 });
  const username = b.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return NextResponse.json({ error: '用户名需为 3-24 位字母、数字或下划线' }, { status: 400 });
  if (b.password.length < 8 || b.password.length > 128) return NextResponse.json({ error: '密码长度需为 8-128 位' }, { status: 400 });
  if (b.nickname.trim().length < 1 || b.nickname.trim().length > 24) return NextResponse.json({ error: '昵称长度需为 1-24 个字符' }, { status: 400 });
  const passwordHash = await hashPassword(b.password);
  const user = {
    id: randomUUID(),
    username,
    passwordHash,
    nickname: b.nickname.trim(),
    avatar: '',
    role: 'user' as const,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
    exp: 0,
    badges: [],
    title: '见习档案员',
  };
  const created = await mutateDb((fresh) => {
    if (fresh.users.some((existing) => existing.username === username)) return false;
    fresh.users.push(user);
    return true;
  });
  if (!created) return NextResponse.json({ error: '用户名已被使用' }, { status: 409 });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
