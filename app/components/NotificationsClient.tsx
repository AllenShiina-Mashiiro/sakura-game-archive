'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
type Note = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  readAt?: string;
};
export function NotificationsClient() {
  const [items, setItems] = useState<Note[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load() {
  try {
    const r = await fetch('/api/notifications', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      setItems(d.items || []);
      setError('');
    } else {
      setError('通知加载失败');
    }
  } catch {
    setError('通知加载失败');
  }
}
  useEffect(() => {
  const run = async () => {
    await load();
  };

  void run();
}, []);
  async function mark(id?: string) {
    setBusy(true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id } : {}),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }
  const icon = (type: string) => ({ message: '✉', comment: '▤', feedback: '◉', badge: '✿', level: '★', system: '✦' })[type] || '•';
  return (
    <div className="notification-center">
      <div className="notification-toolbar">
        <p className="muted">帖子互动、反馈处理、经验奖励、等级徽章和系统消息都会显示在这里。</p>
        <button className="outline-btn" disabled={busy || !items.some((n) => !n.readAt)} onClick={() => mark()}>
          全部标记已读
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {items.map((n) => (
        <article key={n.id} className={`notification-card ${n.readAt ? 'read' : 'unread'}`}>
          <span className="notification-icon">{icon(n.type)}</span>
          <div className="notification-copy">
            <b>{n.title}</b>
            <p>{n.body}</p>
            <small>{new Date(n.createdAt).toLocaleString('zh-CN')}</small>
          </div>
          <div className="notification-actions">
            {n.href && (
              <Link className="subtle-link" href={n.href} onClick={() => !n.readAt && mark(n.id)}>
                查看详情 →
              </Link>
            )}
            {!n.readAt && (
              <button className="text-btn" onClick={() => mark(n.id)}>
                标记已读
              </button>
            )}
          </div>
        </article>
      ))}
      {!items.length && <div className="empty-state">暂时没有通知。</div>}
    </div>
  );
}
