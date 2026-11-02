const TERMINAL_STATUSES = new Set(['rejected', 'fixed', 'failed']);
export function resolveFeedbackTransition({ currentStatus, requestedStatus, isBug }) {
  if (TERMINAL_STATUSES.has(String(currentStatus))) {
    return { ok: false, error: '该问题已结束，不能再次修改状态' };
  }
  if (currentStatus === 'pending') {
    if (requestedStatus === 'rejected') return { ok: true, status: 'rejected', remove: Boolean(isBug) };
    if (requestedStatus === 'accepted') return { ok: true, status: isBug ? 'approved' : 'accepted', remove: false };
    return { ok: false, error: '新反馈必须先通过或拒绝审核' };
  }
  if (isBug && (currentStatus === 'approved' || currentStatus === 'accepted') && requestedStatus === 'processing') {
    return { ok: true, status: 'processing', remove: false };
  }
  if (isBug && currentStatus === 'processing' && (requestedStatus === 'fixed' || requestedStatus === 'failed')) {
    return { ok: true, status: requestedStatus, remove: false };
  }
  return { ok: false, error: '当前状态不允许此操作，请刷新审核列表' };
}
