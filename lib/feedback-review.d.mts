export type FeedbackReviewStatus = 'pending' | 'accepted' | 'rejected' | 'processing' | 'fixed' | 'failed';
export type FeedbackBugSeverity = 'warning' | 'error' | 'critical';

export function buildFeedbackReviewUpdate(args: {
  requestedStatus: unknown;
  accepted: boolean;
  requestedSeverity: unknown;
  currentSeverity?: FeedbackBugSeverity;
  reply: unknown;
  at: string;
  by: string;
  statusHistory?: { status: string; reply: string; at: string; by: string }[];
}): {
  status: Exclude<FeedbackReviewStatus, 'pending'>;
  bugSeverity: FeedbackBugSeverity | undefined;
  reply: string;
  statusHistory: { status: string; reply: string; at: string; by: string }[];
};

export function isFeedbackRepairStatusAllowed(type: unknown, requestedStatus: unknown): boolean;
