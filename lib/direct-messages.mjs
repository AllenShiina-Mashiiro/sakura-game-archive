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
