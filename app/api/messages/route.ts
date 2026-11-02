import type { User } from '@/lib/types';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { mutateDb, readDb } from '@/lib/db';
import type { DirectMessage, UserNotification } from '@/lib/types';
import { hasUnreadDirectMessageActivity } from '@/lib/direct-messages.mjs';
import { normalizeDirectMessageContent } from '@/lib/direct-messages.mjs';
const areFriends = (db: Awaited<ReturnType<typeof readDb>>, a: string, b: string) =>
  (db.friendships || []).some((f) => f.status === 'accepted' && ((f.requesterId === a && f.addresseeId === b) || (f.requesterId === b && f.addresseeId === a)));
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
    // Polling is read-only unless this thread actually contains unread activity.
    const snapshot = await readDb();
    const snapshotPeer = snapshot.users.find((u) => u.id === withId && u.status === 'active');
    if (!snapshotPeer) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    if (!areFriends(snapshot, user.id, withId)) {
      return NextResponse.json({ error: '双方成为好友后才能私信' }, { status: 404 });
    }
    const snapshotMessages = (snapshot.messages || [])
      .filter((m) => (m.fromId === user.id && m.toId === withId) || (m.fromId === withId && m.toId === user.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const needsReadUpdate = hasUnreadDirectMessageActivity({
      messages: snapshotMessages,
      notifications: snapshot.notifications || [],
      userId: user.id,
      peerId: withId,
    });

    if (!needsReadUpdate) {
      return NextResponse.json({
        peer: publicUser(snapshotPeer),
        me: snapshot.users.find((u) => u.id === user.id)
          ? publicUser(snapshot.users.find((u) => u.id === user.id)!)
          : null,
        messages: snapshotMessages,
      });
    }

    const result = await mutateDb((db) => {
      const peer = db.users.find((u) => u.id === withId && u.status === 'active');
      if (!peer) return { error: '用户不存在' };
      if (!areFriends(db, user.id, withId)) return { error: '双方成为好友后才能私信' };
      const messages = (db.messages || [])
        .filter((m) => (m.fromId === user.id && m.toId === withId) || (m.fromId === withId && m.toId === user.id))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const readAt = new Date().toISOString();
      for (const message of messages) {
        if (message.toId === user.id && !message.readAt) message.readAt = readAt;
      }
      for (const notification of db.notifications || []) {
        if (notification.userId === user.id && notification.type === 'message'
          && notification.actorId === withId && !notification.readAt) {
          notification.readAt = readAt;
        }
      }
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
  const activeUsers = db.users.filter((u) => u.id !== user.id && u.status === 'active' && areFriends(db, user.id, u.id));
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
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return NextResponse.json({ contacts, users: [] });
}
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const body = await req.json();
    const toId = String(body.toId || '');
    const normalized = normalizeDirectMessageContent(body.content);
    const content = normalized.content;
    if (!toId || toId === user.id) return NextResponse.json({ error: '请选择有效的收件人' }, { status: 400 });
    if (normalized.error) return NextResponse.json({ error: normalized.error }, { status: 400 });
    const result = await mutateDb((db) => {
      const peer = db.users.find((u) => u.id === toId && u.status === 'active');
      if (!peer) return { error: '收件人不存在或不可用' };
      if (!areFriends(db, user.id, toId)) return { error: '双方成为好友后才能私信' };
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
