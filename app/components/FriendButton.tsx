'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type State = 'loading' | 'none' | 'outgoing' | 'incoming' | 'friend';
export function FriendButton({ userId }: { userId: string }) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function refresh() {
    const r = await fetch('/api/friends', { cache: 'no-store' });
    if (!r.ok) { setState('none'); return; }
    const d = await r.json();
    if ((d.friends || []).some((x: { id: string }) => x.id === userId)) setState('friend');
    else if ((d.incoming || []).some((x: { id: string }) => x.id === userId)) setState('incoming');
    else if ((d.outgoing || []).some((x: { id: string }) => x.id === userId)) setState('outgoing');
    else setState('none');
  }
  useEffect(() => { void refresh(); }, [userId]);
  async function act(action: string) {
    setBusy(true); setNotice('');
    try {
      const r = await fetch('/api/friends', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, targetId: userId }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '操作失败');
      setNotice(d.message || '操作成功');
      await refresh();
    } catch (e) { setNotice(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  }
  if (state === 'loading') return <button className="outline-btn" disabled>加载好友状态…</button>;
  return <div className="friend-action">
    {state === 'friend' ? <><button className="outline-btn" disabled>✓ 已是好友</button><Link className="primary-btn" href={`/messages?with=${encodeURIComponent(userId)}`}>发送私信</Link><button className="text-btn" disabled={busy} onClick={() => act('remove')}>解除好友</button></>
      : state === 'incoming' ? <><button className="primary-btn" disabled={busy} onClick={() => act('accept')}>接受好友请求</button><button className="outline-btn" disabled={busy} onClick={() => act('reject')}>拒绝</button></>
      : state === 'outgoing' ? <button className="outline-btn" disabled>已发送好友请求</button>
      : <button className="primary-btn" disabled={busy} onClick={() => act('request')}>＋ 添加好友</button>}
    {notice && <small role="status">{notice}</small>}
  </div>;
}
