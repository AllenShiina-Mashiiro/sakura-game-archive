'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AdminReview({ id, action }: { id: string; action: string }) {
  const [reply, setReply] = useState('');
  const [severity, setSeverity] = useState<'warning' | 'error' | 'critical'>('warning');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  async function decide(status: string) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, status, reply, severity }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || '操作失败');
      setSuccess(status === 'accepted' ? '审核已通过' : '已拒绝该投稿');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="review-actions">
        {action === 'review-feedback' && <select aria-label="Bug 严重程度" value={severity} onChange={(e) => setSeverity(e.target.value as 'warning' | 'error' | 'critical')}><option value="warning">警告 · 50 EXP</option><option value="error">错误 · 150 EXP</option><option value="critical">严重 · 300 EXP</option></select>}
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="管理员回复（可选）" />
        {action === 'review-feedback' && <><button className="outline-btn" disabled={busy} onClick={() => decide('processing')}>处理中</button><button className="primary-btn" disabled={busy} onClick={() => decide('fixed')}>已修复并发奖</button><button className="outline-btn" disabled={busy} onClick={() => decide('failed')}>修复失败</button></>}
        <button className="primary-btn" disabled={busy} onClick={() => decide('accepted')}>
          通过 / 采纳
        </button>
        <button className="outline-btn" disabled={busy} onClick={() => decide('rejected')}>
          拒绝
        </button>
        {error && <small className="error-text">{error}</small>}
      </div>
      {success && (
        <div className="modal-backdrop" onClick={() => setSuccess('')}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-mark">✓</div>
            <h3>操作成功</h3>
            <p>{success}</p>
            <button className="primary-btn" onClick={() => setSuccess('')}>
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}
