import type { User } from '@/lib/types';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { mutateDb, readDb } from '@/lib/db';
import type { DirectMessage, UserNotification } from '@/lib/types';
export const dynamic = 'force-dynamic';
const publicUser = (u: User) => ({
  id: u.id,
  nickname: u.nickname,
  username: u.username,
  avatar: u.avatar,
  avatarFrame: u.avatarFrame || 'none',
  selectedBadge: u.selectedBadge || '',
  role: u.role,
  title: u.title || '',
});
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const url = new URL(req.url);
  const withId = url.searchParams.get('with');
  if (withId) {
    const result = await mutateDb((db) => {
      const peer = db.users.find((u) => u.id === withId && u.status === 'active');
      if (!peer) return { error: '用户不存在' };
      const messages = (db.messages || []).filter((m) => (m.fromId === user.id && m.toId === withId) || (m.fromId === withId && m.toId === user.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const m of messages) if (m.toId === user.id && !m.readAt) m.readAt = new Date().toISOString();
      for (const n of db.notifications || []) if (n.userId === user.id && n.type === 'message' && n.actorId === withId && !n.readAt) n.readAt = new Date().toISOString();
      return {
        peer: publicUser(peer),
        me: db.users.find((u) => u.id === user.id)
  ? publicUser(db.users.find((u) => u.id === user.id)!)
  : null,
        messages,
      };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json(result);
  }
  const db = await readDb();
  const activeUsers = db.users.filter((u) => u.id !== user.id && u.status === 'active');
  const messages = db.messages || [];
  const contacts = activeUsers
    .map((peer) => {
      const related = messages.filter((m) => (m.fromId === user.id && m.toId === peer.id) || (m.fromId === peer.id && m.toId === user.id));
      const last = related[related.length - 1];
      const unread = related.filter((m) => m.toId === user.id && !m.readAt).length;
      return {
        ...publicUser(peer),
        lastMessage: last?.content || '还没有消息',
        lastAt: last?.createdAt || peer.createdAt,
        unread,
      };
    })
    .filter((x) => messages.some((m) => (m.fromId === user.id && m.toId === x.id) || (m.fromId === x.id && m.toId === user.id)))
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return NextResponse.json({ contacts, users: activeUsers.map(publicUser) });
}
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const body = await req.json();
    const toId = String(body.toId || '');
    const content = String(body.content || '').trim();
    if (!toId || toId === user.id) return NextResponse.json({ error: '请选择有效的收件人' }, { status: 400 });
    if (!content || content.length > 2000) return NextResponse.json({ error: '消息需为 1-2000 个字符' }, { status: 400 });
    const result = await mutateDb((db) => {
      const peer = db.users.find((u) => u.id === toId && u.status === 'active');
      if (!peer) return { error: '收件人不存在或不可用' };
      const now = new Date().toISOString();
      const message: DirectMessage = {
        id: randomUUID(),
        fromId: user.id,
        toId,
        content,
        createdAt: now,
      };
      db.messages = db.messages || [];
      db.messages.push(message);
      db.notifications = db.notifications || [];
      const note: UserNotification = {
        id: randomUUID(),
        userId: toId,
        type: 'message',
        title: '收到一条新私信',
        body: `${user.nickname}：${content.slice(0, 80)}`,
        href: `/messages?with=${encodeURIComponent(user.id)}`,
        createdAt: now,
        actorId: user.id,
      };
      db.notifications.unshift(note);
      return { message };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true, message: result.message });
  } catch {
    return NextResponse.json({ error: '消息发送失败' }, { status: 400 });
  }
}
