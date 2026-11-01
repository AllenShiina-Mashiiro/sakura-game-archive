'use client';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
type Person = {
  id: string;
  nickname: string;
  username: string;
  avatar: string;
  avatarFrame: string;
  selectedBadge: string;
  role: string;
  title: string;
  lastMessage?: string;
  lastAt?: string;
  unread?: number;
};
type Message = {
  id: string;
  fromId: string;
  toId: string;
  content: string;
  createdAt: string;
  readAt?: string;
};
export function MessagesClient() {
  const params = useSearchParams();
  const initial = params.get('with') || '';
  const [contacts, setContacts] = useState<Person[]>([]);
  const [users, setUsers] = useState<Person[]>([]);
  const [peer, setPeer] = useState<Person | null>(null);
  const [myself, setMyself] = useState<Person | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState(initial);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const loadContacts = useCallback(async () => {
    const r = await fetch('/api/messages', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      setContacts(d.contacts || []);
      setUsers(d.users || []);
    }
  }, []);
  const loadThread = useCallback(
    async (id: string) => {
      if (!id) return;
      const r = await fetch(`/api/messages?with=${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        setPeer(d.peer);
        setMyself(d.me || null);
        setMessages(d.messages || []);
        await loadContacts();
      }
    },
    [loadContacts],
  );
  useEffect(() => {
  const run = async () => {
    await loadContacts();
  };

  void run();
}, [loadContacts]);
  useEffect(() => {
  if (!selected) return;

  const run = async () => {
    await loadThread(selected);
  };

  void run();

  const t = setInterval(() => {
    void run();
  }, 5000);

  return () => clearInterval(t);
}, [selected, loadThread]);
  const ordered = useMemo(() => contacts, [contacts]);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!selected || !text.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toId: selected, content: text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '发送失败');
      setText('');
      await Promise.all([loadThread(selected), loadContacts()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setBusy(false);
    }
  }
  const choose = (id: string) => {
    setSelected(id);
    setShowUsers(false);
    history.replaceState(null, '', `/messages?with=${encodeURIComponent(id)}`);
  };
  const avatar = (p: Person) => <span className={`avatar avatar-frame-${p.avatarFrame || 'none'}`}>{p.avatar ? <img src={p.avatar} alt="" /> : p.nickname.slice(0, 1)}</span>;
  return (
    <div className="messages-layout">
      <aside className="conversation-list">
        <div className="conversation-list-head">
          <h2>私信</h2>
          <button className="outline-btn" onClick={() => setShowUsers((v) => !v)}>
            ＋ 新建
          </button>
        </div>
        {showUsers && (
          <div className="people-picker">
            {users.map((p) => (
              <div className="people-picker-row" key={p.id}>
                <Link href={`/users/${p.id}`}>{avatar(p)}</Link>
                <button onClick={() => choose(p.id)}>{p.nickname}</button>
              </div>
            ))}
          </div>
        )}
        {ordered.map((p) => (
          <div key={p.id} className={`conversation-person ${selected === p.id ? 'active' : ''}`}>
            <Link className="conversation-avatar" href={`/users/${p.id}`} title="查看用户主页">
              {avatar(p)}
            </Link>
            <button className="conversation-person-main" onClick={() => choose(p.id)}>
              <span className="conversation-person-copy">
                <b>{p.nickname}</b>
                <small>{p.lastMessage}</small>
              </span>
              {!!p.unread && <i className="unread-dot">{p.unread}</i>}
            </button>
          </div>
        ))}
        {!ordered.length && !showUsers && <p className="muted">还没有好友会话。请先打开对方的个人主页并发送好友请求；成为好友后即可私信。</p>}
      </aside>
      <section className="chat-panel">
        {peer ? (
          <>
            <header className="chat-header">
              <Link href={`/users/${peer.id}`}>{avatar(peer)}</Link>
              <div>
                <Link href={`/users/${peer.id}`}>
                  <b>{peer.nickname}</b>
                </Link>
                <small>@{peer.username} · 点击头像查看主页</small>
              </div>
              <Link className="outline-btn" href={`/users/${peer.id}`}>
                查看主页
              </Link>
            </header>
            <div className="chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={`message-row ${m.fromId === peer.id ? 'incoming' : 'outgoing'}`}>
                  {m.fromId === peer.id && <Link href={`/users/${peer.id}`}>{avatar(peer)}</Link>}
                  {m.fromId !== peer.id && myself && <Link href="/profile">{avatar(myself)}</Link>}
                  <div>
                    <p>{m.content}</p>
                    <small>{new Date(m.createdAt).toLocaleString('zh-CN')}</small>
                  </div>
                </div>
              ))}
              {!messages.length && <div className="empty-state">发送第一条消息，开启对话吧。</div>}
            </div>
            <form className="chat-compose" onSubmit={send}>
              <div className="chat-emoji-picker" aria-label="常用表情">{['😀','😊','🥰','😂','😭','❤️','👍','🎉','🌸','✨','🙏','🤔'].map((emoji) => <button type="button" key={emoji} aria-label={`插入${emoji}`} onClick={() => setText((v) => (v + emoji).slice(0, 2000))}>{emoji}</button>)}</div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="发送消息…" maxLength={2000} rows={2} />
              <div>
                <small>{error || `${text.length}/2000`}</small>
                <button className="primary-btn" disabled={busy || !text.trim()}>
                  {busy ? '发送中…' : '发送'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="chat-empty">
            <span>✉</span>
            <h2>选择一个会话</h2>
            <p>仅好友之间可以私信。请先从成员个人主页添加好友。</p>
            <button className="primary-btn" onClick={() => setShowUsers(true)}>
              开始新对话
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
