'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { mediaUrl } from '@/lib/media';

type Friend = {
  id: string;
  nickname: string;
  username: string;
  avatar: string;
  avatarFrame: string;
  status: 'pending' | 'accepted' | 'rejected';
  direction: 'incoming' | 'outgoing';
};

type FriendData = {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
};

export function FriendsClient() {
  const [data, setData] = useState<FriendData>({ friends: [], incoming: [], outgoing: [] });
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/friends', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '好友列表加载失败');
      setData({
        friends: result.friends || [],
        incoming: result.incoming || [],
        outgoing: result.outgoing || [],
      });
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '好友列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  async function act(friend: Friend, action: 'accept' | 'reject' | 'remove' | 'request') {
    if (action === 'remove' && !window.confirm(`确定解除与 ${friend.nickname} 的好友关系吗？`)) return;
    setBusyId(friend.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId: friend.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '好友操作失败');
      setMessage(result.message || '好友关系已更新');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '好友操作失败');
    } finally {
      setBusyId('');
    }
  }

  async function searchUsers() {
    const q = search.trim();
    if (!q) { setMatches([]); return; }
    setSearching(true); setError('');
    try { const response = await fetch('/api/friends?q=' + encodeURIComponent(q), { cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result.error || '搜索失败'); setMatches((result.matches || []).map((x: Friend) => ({ ...x, status: 'pending', direction: 'outgoing' }))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '搜索失败'); }
    finally { setSearching(false); }
  }

  function card(friend: Friend, kind: 'friend' | 'incoming' | 'outgoing' | 'search') {
    return (
      <article className="content-card friend-list-card" key={friend.id}>
        <Link className="friend-list-avatar" href={`/users/${encodeURIComponent(friend.username)}`} title={`查看${friend.nickname}的主页`}>
          <span className={`avatar avatar-large avatar-frame-${friend.avatarFrame || 'none'}`}>
            {friend.avatar ? <img src={mediaUrl(friend.avatar)} alt="" /> : friend.nickname.slice(0, 1)}
          </span>
        </Link>
        <div className="friend-list-info">
          <h3><Link href={`/users/${encodeURIComponent(friend.username)}`}>{friend.nickname}</Link></h3>
          <small>@{friend.username}</small>
          <div className="friend-list-actions">
            <Link className="outline-btn" href={`/users/${encodeURIComponent(friend.username)}`}>查看主页</Link>
            {kind === 'friend' && <Link className="primary-btn" href={`/messages?with=${encodeURIComponent(friend.id)}`}>发送私信</Link>}
            {kind === 'friend' && <button className="text-btn" disabled={busyId === friend.id} onClick={() => void act(friend, 'remove')}>解除好友</button>}
            {kind === 'incoming' && <>
              <button className="primary-btn" disabled={busyId === friend.id} onClick={() => void act(friend, 'accept')}>接受</button>
              <button className="outline-btn" disabled={busyId === friend.id} onClick={() => void act(friend, 'reject')}>拒绝</button>
            </>}
            {kind === 'outgoing' && <span className="tag">等待对方处理</span>}
            {kind === 'search' && <button className="primary-btn" disabled={busyId === friend.id} onClick={() => void act(friend, 'request')}>添加好友</button>}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div className="friends-page-content">
      {error && <p className="error-box">{error}</p>}
      {loading && <p className="muted">正在加载好友列表…</p>}
      {message && <p className="success-inline" role="status">{message}</p>}
      <section className="detail-section friend-search-panel">
        <div className="section-head"><div><h2>搜索好友</h2><p className="muted">输入昵称查找允许被搜索的社区成员。</p></div></div>
        <form className="archive-search" onSubmit={(event) => { event.preventDefault(); void searchUsers(); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="输入好友昵称…" maxLength={40} /><button className="primary-btn" disabled={searching || !search.trim()}>{searching ? "搜索中…" : "搜索"}</button></form>
        <div className="content-grid">{matches.map((friend) => card(friend, "search"))}</div>
        {!searching && search.trim() && !matches.length && <p className="muted">没有找到匹配用户，或对方关闭了好友搜索。</p>}
      </section>
      <section className="detail-section">
        <div className="section-head">
          <div><h2>我的好友 · {data.friends.length}</h2><p className="muted">点击头像或昵称即可查看公开主页。</p></div>
        </div>
        <div className="content-grid">
          {data.friends.map((friend) => card(friend, 'friend'))}
          {!data.friends.length && <div className="empty-state">还没有好友。可以从社区成员的公开主页发送好友请求。</div>}
        </div>
      </section>
      <section className="detail-section">
        <div className="section-head"><div><h2>收到的请求 · {data.incoming.length}</h2></div></div>
        <div className="content-grid">
          {data.incoming.map((friend) => card(friend, 'incoming'))}
          {!data.incoming.length && <div className="empty-state">暂时没有待处理的好友请求。</div>}
        </div>
      </section>
      <section className="detail-section">
        <div className="section-head"><div><h2>已发送请求 · {data.outgoing.length}</h2></div></div>
        <div className="content-grid">
          {data.outgoing.map((friend) => card(friend, 'outgoing'))}
          {!data.outgoing.length && <div className="empty-state">没有等待处理的好友请求。</div>}
        </div>
      </section>
    </div>
  );
}
