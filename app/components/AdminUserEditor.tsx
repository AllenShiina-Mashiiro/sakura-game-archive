'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AdminUserEditor({ user }: { user: { id: string; role: string; status: string; exp: number; title: string; badges: string[] } }) {
  const [v, setV] = useState({
    role: user.role,
    status: user.status,
    exp: String(user.exp),
    title: user.title,
    badges: user.badges.join(', '),
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();
  async function save() {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'user-update', id: user.id, ...v, exp: Number(v.exp) }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || '保存失败');
      setMsg('账户设置已保存');
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="user-editor">
      <select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
        <option value="user">普通用户</option>
        <option value="vip">VIP</option>
        <option value="admin">管理员</option>
      </select>
      <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value })}>
        <option value="active">正常</option>
        <option value="banned">封禁</option>
      </select>
      <input type="number" value={v.exp} onChange={(e) => setV({ ...v, exp: e.target.value })} aria-label="经验" />
      <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="头衔" />
      <input value={v.badges} onChange={(e) => setV({ ...v, badges: e.target.value })} placeholder="徽章，以逗号分隔" />
      <button className="outline-btn" disabled={busy} onClick={save}>
        {busy ? '保存中…' : '保存'}
      </button>
      {msg && (
        <div className="modal-backdrop" onClick={() => setMsg('')}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-mark">✓</div>
            <h3>操作成功</h3>
            <p>{msg}</p>
            <button className="primary-btn" onClick={() => setMsg('')}>
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
