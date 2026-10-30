'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AdminReview({ id, action }: { id: string; action: string }) {
  const [reply, setReply] = useState('');
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
        body: JSON.stringify({ action, id, status, reply }),
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
        <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="管理员回复（可选）" />
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
