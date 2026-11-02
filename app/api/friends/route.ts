import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { mutateDb, readDb } from '@/lib/db';
import type { Friendship } from '@/lib/types';
import { decideFriendRequestAction, isUnreadFriendRequestNotification } from '@/lib/friend-requests.mjs';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  const db = await readDb();
  const query = new URL(req.url).searchParams.get('q')?.trim().slice(0, 40) || '';
  if (query) {
    const matches = db.users.filter((candidate) => candidate.id !== user.id && candidate.status === 'active' && candidate.discoverable !== false)
      .filter((candidate) => candidate.nickname.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      .slice(0, 20)
      .map((candidate) => ({ id: candidate.id, nickname: candidate.nickname, username: candidate.username, avatar: candidate.avatar, avatarFrame: candidate.avatarFrame || 'none' }));
    return NextResponse.json({ matches });
  }
  const users = new Map(db.users.filter((u) => u.status === 'active').map((u) => [u.id, u]));
  const rows = (db.friendships || []).filter((f) => f.requesterId === user.id || f.addresseeId === user.id);
  const shape = (f: Friendship) => {
    const id = f.requesterId === user.id ? f.addresseeId : f.requesterId;
    const peer = users.get(id);
    return peer ? { id: peer.id, nickname: peer.nickname, username: peer.username, avatar: peer.avatar, avatarFrame: peer.avatarFrame || 'none', status: f.status, direction: f.requesterId === user.id ? 'outgoing' : 'incoming' } : null;
  };
  return NextResponse.json({
    friends: rows.filter((f) => f.status === 'accepted').map(shape).filter(Boolean),
    incoming: rows.filter((f) => f.status === 'pending' && f.addresseeId === user.id).map(shape).filter(Boolean),
    outgoing: rows.filter((f) => f.status === 'pending' && f.requesterId === user.id).map(shape).filter(Boolean),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const body = await req.json();
    const action = String(body.action || '');
    const targetId = String(body.targetId || '');
    if (!targetId || targetId === user.id) return NextResponse.json({ error: '无效的好友对象' }, { status: 400 });
    const result = await mutateDb((db) => {
      const peer = db.users.find((u) => u.id === targetId && u.status === 'active');
      if (!peer) return { error: '用户不存在或不可用' };
      db.friendships = db.friendships || [];
      const relation = db.friendships.find((f) =>
        (f.requesterId === user.id && f.addresseeId === targetId) ||
        (f.requesterId === targetId && f.addresseeId === user.id));
      const now = new Date().toISOString();
      if (action === 'request') {
        if (relation?.status === 'accepted') return { error: '你们已经是好友' };
        if (relation?.status === 'rejected') {
          relation.requesterId = user.id;
          relation.addresseeId = targetId;
          relation.status = 'pending';
          relation.createdAt = now;
          relation.updatedAt = now;
          db.notifications = db.notifications || [];
          db.notifications.unshift({
            id: randomUUID(),
            userId: targetId,
            type: 'system',
            title: '收到好友请求',
            body: user.nickname + ' 想添加你为好友',
            href: '/notifications',
            createdAt: now,
            actorId: user.id,
          });
          return { ok: true, message: '好友请求已重新发送' };
        }
        if (relation?.status === 'pending') {
          if (relation.addresseeId === user.id) {
            relation.status = 'accepted';
            relation.updatedAt = now;
            for (const notification of db.notifications || []) {
              if (isUnreadFriendRequestNotification(notification, user.id, targetId)) {
                notification.readAt = now;
              }
            }
            return { ok: true, message: '已接受好友请求' };
          }
          return { error: '好友请求已发送，请等待对方处理' };
        }
        const row: Friendship = { id: randomUUID(), requesterId: user.id, addresseeId: targetId, status: 'pending', createdAt: now, updatedAt: now };
        db.friendships.push(row);
        db.notifications = db.notifications || [];
        db.notifications.unshift({ id: randomUUID(), userId: targetId, type: 'system', title: '收到好友请求', body: user.nickname + ' 想添加你为好友', href: '/notifications', createdAt: now, actorId: user.id });
        return { ok: true, message: '好友请求已发送' };
      }
      if (action === 'accept' || action === 'reject' || action === 'ignore') {
        const decision = decideFriendRequestAction({ action, relation, userId: user.id });
        if ('error' in decision) return { error: decision.error };
        if (decision.kind === 'ignore') {
          // 忽略只隐藏当前通知，不改变好友请求状态，用户之后仍可在主页处理。
          for (const notification of db.notifications || []) {
            if (isUnreadFriendRequestNotification(notification, user.id, targetId)) {
              notification.readAt = now;
            }
          }
          return { ok: true, message: decision.message };
        }
        relation!.status = decision.status;
        relation!.updatedAt = now;
        // Keep request notifications in sync regardless of whether the request
        // was handled from the notification center or the sender's profile.
        for (const notification of db.notifications || []) {
          if (isUnreadFriendRequestNotification(notification, user.id, targetId)) {
            notification.readAt = now;
          }
        }
        return { ok: true, message: decision.message };
      }
      if (action === 'remove') {
        if (!relation || relation.status !== 'accepted') return { error: '好友关系不存在' };
        db.friendships = db.friendships.filter((f) => f.id !== relation.id);
        return { ok: true, message: '已解除好友关系' };
      }
      return { error: '不支持的好友操作' };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: '好友操作失败' }, { status: 400 });
  }
}
