import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedbackReviewUpdate, isFeedbackRepairStatusAllowed } from '../lib/feedback-review.mjs';

const base = {
  accepted: false,
  requestedSeverity: 'error',
  currentSeverity: 'warning',
  reply: '正在核查',
  at: '2026-11-02T10:00:00.000Z',
  by: '管理员',
  statusHistory: [{ status: 'pending', reply: '已提交', at: '2026-11-01T10:00:00.000Z', by: '用户' }],
};

test('explicit processing, fixed and failed statuses take precedence over accepted flag', () => {
  for (const status of ['processing', 'fixed', 'failed']) {
    const result = buildFeedbackReviewUpdate({ ...base, requestedStatus: status });
    assert.equal(result.status, status);
  }
});

test('accepted flag selects accepted when there is no explicit workflow status', () => {
  assert.equal(buildFeedbackReviewUpdate({ ...base, requestedStatus: 'accepted', accepted: true }).status, 'accepted');
});

test('rejected is the fallback for an unrecognized status without acceptance', () => {
  assert.equal(buildFeedbackReviewUpdate({ ...base, requestedStatus: 'unexpected', accepted: false }).status, 'rejected');
});

test('valid severity replaces the previous severity and invalid severity preserves it', () => {
  assert.equal(buildFeedbackReviewUpdate({ ...base, requestedStatus: 'fixed', requestedSeverity: 'critical' }).bugSeverity, 'critical');
  assert.equal(buildFeedbackReviewUpdate({ ...base, requestedStatus: 'fixed', requestedSeverity: 'invalid' }).bugSeverity, 'warning');
});

test('review reply is normalized and appended to a copied history list', () => {
  const result = buildFeedbackReviewUpdate({ ...base, requestedStatus: 'processing', reply: null });
  assert.equal(result.reply, '');
  assert.equal(result.statusHistory.length, 2);
  assert.equal(result.statusHistory[1].status, 'processing');
  assert.equal(result.statusHistory[1].reply, '');
  assert.equal(result.statusHistory[1].by, '管理员');
  assert.equal(base.statusHistory.length, 1);
});

test('missing history starts a new history list', () => {
  const result = buildFeedbackReviewUpdate({ ...base, requestedStatus: 'fixed', statusHistory: undefined });
  assert.equal(result.statusHistory.length, 1);
  assert.equal(result.statusHistory[0].status, 'fixed');
});

test('repair statuses are allowed only for Bug feedback', () => {
  assert.equal(isFeedbackRepairStatusAllowed('游戏 Bug', 'fixed'), true);
  assert.equal(isFeedbackRepairStatusAllowed('website BUG', 'failed'), true);
  assert.equal(isFeedbackRepairStatusAllowed('功能建议', 'processing'), true);
  assert.equal(isFeedbackRepairStatusAllowed('功能建议', 'fixed'), false);
  assert.equal(isFeedbackRepairStatusAllowed('游戏运行问题', 'failed'), false);
});
