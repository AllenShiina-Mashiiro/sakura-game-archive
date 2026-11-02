import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackRewardFor, shouldGrantFeedbackReward } from '../lib/feedback-rewards.mjs';

test('Bug fixed reward follows warning/error/critical severity', () => {
  assert.equal(feedbackRewardFor({ type: 'Bug', nextStatus: 'fixed', severity: 'warning' }), 50);
  assert.equal(feedbackRewardFor({ type: 'bug report', nextStatus: 'fixed', severity: 'error' }), 150);
  assert.equal(feedbackRewardFor({ type: 'BUG', nextStatus: 'fixed', severity: 'critical' }), 300);
});

test('accepted non-bug feedback receives 100 EXP', () => {
  assert.equal(feedbackRewardFor({ type: '建议', nextStatus: 'accepted', severity: undefined }), 100);
});

test('bug accepted uses the ordinary accepted-feedback reward', () => {
  assert.equal(feedbackRewardFor({ type: 'Bug', nextStatus: 'accepted', severity: 'critical' }), 100);
});

test('non-final statuses do not grant rewards', () => {
  assert.equal(feedbackRewardFor({ type: 'Bug', nextStatus: 'processing', severity: 'critical' }), null);
  assert.equal(feedbackRewardFor({ type: 'Bug', nextStatus: 'failed', severity: 'critical' }), null);
});

test('a pending feedback item can grant once on its first final transition', () => {
  assert.equal(shouldGrantFeedbackReward({ rewardGranted: false, previousStatus: 'pending', nextStatus: 'fixed' }), true);
  assert.equal(shouldGrantFeedbackReward({ rewardGranted: false, previousStatus: 'pending', nextStatus: 'accepted' }), true);
});

test('reward marker and previous final states prevent another grant', () => {
  assert.equal(shouldGrantFeedbackReward({ rewardGranted: true, previousStatus: 'pending', nextStatus: 'fixed' }), false);
  assert.equal(shouldGrantFeedbackReward({ rewardGranted: false, previousStatus: 'fixed', nextStatus: 'accepted' }), false);
  assert.equal(shouldGrantFeedbackReward({ rewardGranted: false, previousStatus: 'accepted', nextStatus: 'fixed' }), false);
});
