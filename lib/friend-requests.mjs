export function decideFriendRequestAction({ action, relation, userId }) {
  if (!relation || relation.status !== 'pending' || relation.addresseeId !== userId) {
    return { error: '没有可处理的好友请求' };
  }

  if (action === 'ignore') {
    return { kind: 'ignore', message: '已忽略该请求，之后仍可处理' };
  }

  if (action === 'accept') {
    return { kind: 'update', status: 'accepted', message: '已成为好友' };
  }

  if (action === 'reject') {
    return { kind: 'update', status: 'rejected', message: '已拒绝好友请求' };
  }

  return { error: '不支持的好友操作' };
}

export function isUnreadFriendRequestNotification(notification, userId, actorId) {
  return notification.userId === userId
    && notification.actorId === actorId
    && notification.title === '收到好友请求'
    && !notification.readAt;
}
