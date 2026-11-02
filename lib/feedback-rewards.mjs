const FINAL_FEEDBACK_STATUSES = new Set(['accepted', 'fixed']);

/**
 * Returns the one-time EXP reward for a completed feedback item.
 * Bug reports receive severity-based rewards only when marked fixed;
 * accepted non-bug feedback keeps the 100 EXP rule.
 */
export function feedbackRewardFor({ type, nextStatus, severity }) {
  if (!FINAL_FEEDBACK_STATUSES.has(nextStatus)) return null;

  if (/bug/i.test(String(type)) && nextStatus === 'fixed') {
    if (severity === 'critical') return 300;
    if (severity === 'error') return 150;
    return 50;
  }

  return 100;
}

/**
 * A feedback item may grant a reward only on its first transition to a final state.
 * Previously-final records are treated as already handled for legacy compatibility.
 */
export function shouldGrantFeedbackReward({ rewardGranted, previousStatus, nextStatus }) {
  return FINAL_FEEDBACK_STATUSES.has(nextStatus)
    && !rewardGranted
    && !FINAL_FEEDBACK_STATUSES.has(previousStatus);
}
