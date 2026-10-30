'use client';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
export function ActionForm({ action, children, button = '提交', className = 'stack-form', successMessage = '操作成功，内容已保存' }: { action: string; children?: ReactNode; button?: string; className?: string; successMessage?: string }) {
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || '提交失败');
      setOk(d.message || successMessage);
      form.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={className} onSubmit={submit}>
      {children}
      {error && <div className="error-box">{error}</div>}
      {ok && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOk('')}>
          <div className="success-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="success-mark">✓</div>
            <h3>操作成功</h3>
            <p>{ok}</p>
            <button type="button" className="primary-btn" onClick={() => setOk('')}>
              知道了
            </button>
          </div>
        </div>
      )}
      <button className="primary-btn" disabled={busy}>
        {busy ? '提交中…' : button}
      </button>
    </form>
  );
}
export function FavoriteButton({ targetType, targetId }: { targetType: 'game' | 'guide' | 'resource'; targetId: string }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function toggle() {
    setBusy(true);
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'favorite', targetType, targetId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '收藏操作失败');
      setSaved(d.favorited);
      setNotice(d.favorited ? '收藏成功' : '已取消收藏');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '收藏操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="outline-btn" onClick={toggle} disabled={busy}>
        {busy ? '处理中…' : saved ? '♥ 已收藏' : '♡ 收藏'}
      </button>
      {notice && (
        <div className="modal-backdrop" onClick={() => setNotice('')}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-mark">✓</div>
            <h3>{notice}</h3>
            <p>{notice}</p>
            <button className="primary-btn" onClick={() => setNotice('')}>
              知道了
            </button>
          </div>
        </div>
      )}
    </>
  );
}
