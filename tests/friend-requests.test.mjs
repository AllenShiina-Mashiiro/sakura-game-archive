import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideFriendRequestAction,
  isUnreadFriendRequestNotification,
} from '../lib/friend-requests.mjs';

const pendingIncoming = {
  id: 'friendship-1',
  requesterId: 'sender',
  addresseeId: 'receiver',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('recipient can accept a pending incoming request', () => {
  assert.deepEqual(
    decideFriendRequestAction({ action: 'accept', relation: pendingIncoming, userId: 'receiver' }),
    { kind: 'update', status: 'accepted', message: '已成为好友' },
  );
});

test('recipient can reject a pending incoming request', () => {
  assert.deepEqual(
    decideFriendRequestAction({ action: 'reject', relation: pendingIncoming, userId: 'receiver' }),
    { kind: 'update', status: 'rejected', message: '已拒绝好友请求' },
  );
});

test('ignore keeps the request pending for later handling', () => {
  assert.deepEqual(
    decideFriendRequestAction({ action: 'ignore', relation: pendingIncoming, userId: 'receiver' }),
    { kind: 'ignore', message: '已忽略该请求，之后仍可处理' },
  );
});

test('sender cannot process their own outgoing request', () => {
  assert.deepEqual(
    decideFriendRequestAction({ action: 'accept', relation: pendingIncoming, userId: 'sender' }),
    { error: '没有可处理的好友请求' },
  );
});

test('missing or already processed requests cannot be handled again', () => {
  assert.deepEqual(
    decideFriendRequestAction({ action: 'accept', relation: undefined, userId: 'receiver' }),
    { error: '没有可处理的好友请求' },
  );
  assert.deepEqual(
    decideFriendRequestAction({
      action: 'reject',
      relation: { ...pendingIncoming, status: 'accepted' },
      userId: 'receiver',
    }),
    { error: '没有可处理的好友请求' },
  );
});

test('only the matching unread friend-request notification is marked for hiding', () => {
  const matching = {
    userId: 'receiver',
    actorId: 'sender',
    title: '收到好友请求',
  };
  assert.equal(isUnreadFriendRequestNotification(matching, 'receiver', 'sender'), true);
  assert.equal(isUnreadFriendRequestNotification({ ...matching, readAt: 'now' }, 'receiver', 'sender'), false);
  assert.equal(isUnreadFriendRequestNotification({ ...matching, actorId: 'other' }, 'receiver', 'sender'), false);
  assert.equal(isUnreadFriendRequestNotification({ ...matching, title: '普通通知' }, 'receiver', 'sender'), false);
  assert.equal(isUnreadFriendRequestNotification({ ...matching, userId: 'other' }, 'receiver', 'sender'), false);
});
