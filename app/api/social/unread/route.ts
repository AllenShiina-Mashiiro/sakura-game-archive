import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const db = await readDb();
  return NextResponse.json({
    unreadMessages: (db.messages || []).filter((m) => m.toId === user.id && !m.readAt).length,
    unreadNotifications: (db.notifications || []).filter((n) => n.userId === user.id && !n.readAt).length,
  });
}
