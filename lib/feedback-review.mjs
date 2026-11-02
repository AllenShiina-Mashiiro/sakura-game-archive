const validSeverities = new Set(['warning', 'error', 'critical']);
const explicitStatuses = new Set(['processing', 'fixed', 'failed']);

export function buildFeedbackReviewUpdate({
  requestedStatus,
  accepted,
  requestedSeverity,
  currentSeverity,
  reply,
  at,
  by,
  statusHistory,
}) {
  const status = explicitStatuses.has(String(requestedStatus))
    ? String(requestedStatus)
    : accepted ? 'accepted' : 'rejected';
  const bugSeverity = validSeverities.has(String(requestedSeverity))
    ? String(requestedSeverity)
    : currentSeverity;
  const normalizedReply = String(reply || '');
  const history = Array.isArray(statusHistory) ? [...statusHistory] : [];

  history.push({ status, reply: normalizedReply, at, by });

  return {
    status,
    bugSeverity,
    reply: normalizedReply,
    statusHistory: history,
  };
}
