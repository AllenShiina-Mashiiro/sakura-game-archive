import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { mutateDb, readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const db = await readDb();
  const items = (db.notifications || [])
    .filter((n) => n.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  return NextResponse.json({ items, unread: items.filter((n) => !n.readAt).length });
}
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const body = await req.json();
    const id = String(body.id || '');
    await mutateDb((db) => {
      db.notifications = db.notifications || [];
      for (const n of db.notifications) if (n.userId === user.id && (!id || n.id === id) && !n.readAt) n.readAt = new Date().toISOString();
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '更新通知失败' }, { status: 400 });
  }
}
