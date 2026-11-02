export type FeedbackFinalStatus = 'accepted' | 'fixed';
export type FeedbackRewardSeverity = 'warning' | 'error' | 'critical' | undefined;
export function feedbackRewardFor(input: {
  type: string;
  nextStatus: string;
  severity: FeedbackRewardSeverity;
}): number | null;
export function shouldGrantFeedbackReward(input: {
  rewardGranted?: boolean;
  previousStatus: string;
  nextStatus: string;
}): boolean;
