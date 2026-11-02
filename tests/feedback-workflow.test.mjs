import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFeedbackTransition } from '../lib/feedback-workflow.mjs';

test('a bug must pass review before processing and can only finish from processing', () => {
  assert.deepEqual(resolveFeedbackTransition({ currentStatus: 'pending', requestedStatus: 'fixed', isBug: true }).ok, false);
  assert.deepEqual(resolveFeedbackTransition({ currentStatus: 'pending', requestedStatus: 'accepted', isBug: true }), { ok: true, status: 'approved', remove: false });
  assert.deepEqual(resolveFeedbackTransition({ currentStatus: 'approved', requestedStatus: 'processing', isBug: true }), { ok: true, status: 'processing', remove: false });
  assert.deepEqual(resolveFeedbackTransition({ currentStatus: 'processing', requestedStatus: 'fixed', isBug: true }), { ok: true, status: 'fixed', remove: false });
  assert.equal(resolveFeedbackTransition({ currentStatus: 'fixed', requestedStatus: 'failed', isBug: true }).ok, false);
});

test('rejecting a bug removes it, while rejecting ordinary feedback records rejection', () => {
  assert.deepEqual(resolveFeedbackTransition({ currentStatus: 'pending', requestedStatus: 'rejected', isBug: true }), { ok: true, status: 'rejected', remove: true });
  assert.deepEqual(resolveFeedbackTransition({ currentStatus: 'pending', requestedStatus: 'rejected', isBug: false }), { ok: true, status: 'rejected', remove: false });
});

test('ordinary feedback cannot enter the bug repair workflow', () => {
  assert.equal(resolveFeedbackTransition({ currentStatus: 'accepted', requestedStatus: 'processing', isBug: false }).ok, false);
  assert.deepEqual(resolveFeedbackTransition({ currentStatus: 'pending', requestedStatus: 'accepted', isBug: false }), { ok: true, status: 'accepted', remove: false });
});
