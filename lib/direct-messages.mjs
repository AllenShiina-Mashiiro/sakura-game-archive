/**
 * Normalize a direct-message body without altering Unicode content.
 * The length limit follows JavaScript string length, matching textarea maxLength.
 */
export function normalizeDirectMessageContent(value) {
  const content = String(value || '').trim();
  if (!content) return { content: '', error: '消息需为 1-2000 个字符' };
  if (content.length > 2000) return { content: '', error: '消息需为 1-2000 个字符' };
  return { content, error: null };
}

/**
 * Whether opening a thread needs a database write to mark unread activity as read.
 */
export function hasUnreadDirectMessageActivity({ messages, notifications, userId, peerId }) {
  const hasUnreadMessage = (messages || []).some(
    (message) => message.toId === userId && message.fromId === peerId && !message.readAt,
  );
  const hasUnreadNotification = (notifications || []).some(
    (notification) => notification.userId === userId
      && notification.type === 'message'
      && notification.actorId === peerId
      && !notification.readAt,
  );
  return hasUnreadMessage || hasUnreadNotification;
}
