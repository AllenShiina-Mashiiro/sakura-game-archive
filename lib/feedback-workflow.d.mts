export type FeedbackWorkflowResult =
  | { ok: true; status: 'approved' | 'accepted' | 'rejected' | 'processing' | 'fixed' | 'failed'; remove: boolean }
  | { ok: false; error: string };
export function resolveFeedbackTransition(input: {
  currentStatus: string;
  requestedStatus: string;
  isBug: boolean;
}): FeedbackWorkflowResult;
