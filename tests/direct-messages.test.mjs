import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDirectMessageContent, hasUnreadDirectMessageActivity } from '../lib/direct-messages.mjs';

test('preserves standalone and compound emoji exactly', () => {
  const value = '😀 🥰 ❤️ 👨‍👩‍👧‍👦 🏳️‍🌈';
  assert.deepEqual(normalizeDirectMessageContent(value), { content: value, error: null });
});

test('preserves mixed Chinese, English, punctuation and emoji', () => {
  const value = '你好，Hello! 今天更新了吗？🌸✨';
  assert.deepEqual(normalizeDirectMessageContent(value), { content: value, error: null });
});

test('trims surrounding whitespace without changing message content', () => {
  assert.deepEqual(normalizeDirectMessageContent('  好的！👍  '), { content: '好的！👍', error: null });
});

test('rejects empty or whitespace-only messages', () => {
  assert.equal(normalizeDirectMessageContent('').error, '消息需为 1-2000 个字符');
  assert.equal(normalizeDirectMessageContent('   ').error, '消息需为 1-2000 个字符');
});

test('accepts exactly 2000 JavaScript characters and rejects longer messages', () => {
  assert.equal(normalizeDirectMessageContent('a'.repeat(2000)).content.length, 2000);
  assert.equal(normalizeDirectMessageContent('a'.repeat(2001)).error, '消息需为 1-2000 个字符');
});

test('does not request a database write when a thread has no unread activity', () => {
  assert.equal(hasUnreadDirectMessageActivity({
    messages: [{ fromId: 'peer', toId: 'me', readAt: 'already-read' }],
    notifications: [{ userId: 'me', type: 'message', actorId: 'peer', readAt: 'already-read' }],
    userId: 'me',
    peerId: 'peer',
  }), false);
});

test('detects unread incoming messages but ignores messages sent by the current user', () => {
  assert.equal(hasUnreadDirectMessageActivity({
    messages: [{ fromId: 'peer', toId: 'me' }],
    notifications: [],
    userId: 'me',
    peerId: 'peer',
  }), true);
  assert.equal(hasUnreadDirectMessageActivity({
    messages: [{ fromId: 'me', toId: 'peer' }],
    notifications: [],
    userId: 'me',
    peerId: 'peer',
  }), false);
});

test('detects only unread message notifications from the selected peer', () => {
  assert.equal(hasUnreadDirectMessageActivity({
    messages: [],
    notifications: [{ userId: 'me', type: 'message', actorId: 'peer' }],
    userId: 'me',
    peerId: 'peer',
  }), true);
  assert.equal(hasUnreadDirectMessageActivity({
    messages: [],
    notifications: [{ userId: 'me', type: 'message', actorId: 'other' }],
    userId: 'me',
    peerId: 'peer',
  }), false);
  assert.equal(hasUnreadDirectMessageActivity({
    messages: [],
    notifications: [{ userId: 'me', type: 'system', actorId: 'peer' }],
    userId: 'me',
    peerId: 'peer',
  }), false);
});
