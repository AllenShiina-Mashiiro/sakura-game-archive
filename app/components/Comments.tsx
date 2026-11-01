'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mediaUrl } from '@/lib/media';
import Link from 'next/link';
type C = {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;
  likes: string[];
  pinned: boolean;
  nickname: string;
  avatar: string;
  level: number;
  badges: string[];
  avatarFrame: string;
};
export function Comments({ targetType, targetId, items, me, admin }: { targetType: 'game' | 'guide' | 'resource'; targetId: string; items: C[]; me: string; admin: boolean }) {
  const [content, setContent] = useState('');
  const [reply, setReply] = useState('');
  const [editing, setEditing] = useState('');
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const router = useRouter();
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '操作失败');
      const messages: Record<string, string> = {
        'comment-save': '评论发布成功',
        'comment-edit': '评论修改成功',
        'comment-delete': '评论已彻底删除',
        'comment-like': d.liked ? '点赞成功' : '已取消点赞',
        'comment-pin': '评论置顶状态已更新',
      };
      setNotice(messages[action] || '操作成功');
      if (action === 'comment-delete') setEditing('');
      router.refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  const roots = items.filter((x) => !x.parentId);
  function render(c: C) {
    const children = items.filter((x) => x.parentId === c.id);
    return (
      <article className={`comment-card ${c.pinned ? 'comment-pinned' : ''}`} key={c.id}>
        <div className="comment-head">
          <Link href={`/users/${encodeURIComponent(c.userId)}`} className="comment-author-avatar" aria-label={`查看${c.nickname}的主页`}><span className={`avatar avatar-frame-${c.avatarFrame || 'none'}`}>{c.avatar ? <img src={mediaUrl(c.avatar)} alt="" /> : c.nickname.slice(0, 1)}</span></Link>
          <div>
            <b><Link href={`/users/${encodeURIComponent(c.userId)}`}>{c.nickname}</Link></b>
            <small>
              Lv.{c.level}{' '}
              {c.badges.map((x) => (
                <i className="badge-chip" key={x}>
                  {x}
                </i>
              ))}{' '}
              · {new Date(c.createdAt).toLocaleString()}
            </small>
          </div>
          {c.pinned && <span className="tag">置顶</span>}
        </div>
        {editing === c.id ? (
          <div className="comment-edit">
            <textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
            <button className="primary-btn" disabled={busy} onClick={() => act('comment-edit', { id: c.id, content: editText }).then(() => setEditing(''))}>
              保存修改
            </button>
          </div>
        ) : (
          <p>
            {c.content}
            {c.updatedAt && <small>（已编辑）</small>}
          </p>
        )}
        <div className="comment-actions">
          <button disabled={busy} onClick={() => act('comment-like', { id: c.id })}>
            ♥ {c.likes?.length || 0}
          </button>
          <button onClick={() => setReply(reply === c.id ? '' : c.id)}>回复</button>
          {(c.userId === me || admin) && (
            <>
              <button
                onClick={() => {
                  setEditing(c.id);
                  setEditText(c.content);
                }}
              >
                修改
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (confirm('撤回后评论及其回复将被彻底删除，无法恢复。确定继续吗？')) act('comment-delete', { id: c.id });
                }}
              >
                撤回并删除
              </button>
            </>
          )}
          {admin && <button onClick={() => act('comment-pin', { id: c.id })}>{c.pinned ? '取消置顶' : '置顶'}</button>}
          {reply === c.id && (
            <div className="reply-box">
              <textarea id={`reply-${c.id}`} placeholder="回复这条评论…" />
              <button
                className="outline-btn"
                disabled={busy}
                onClick={() => {
                  const el = document.getElementById(`reply-${c.id}`) as HTMLTextAreaElement | null;
                  if (el?.value.trim())
                    act('comment-save', {
                      targetType,
                      targetId,
                      parentId: c.id,
                      content: el.value,
                    }).then(() => setReply(''));
                }}
              >
                发送回复
              </button>
            </div>
          )}
        </div>
        {children.length > 0 && <div className="comment-children">{children.map(render)}</div>}
      </article>
    );
  }
  return (
    <section className="comments-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">COMMUNITY DISCUSSION</div>
          <h2>评论区 · {items.length}</h2>
        </div>
      </div>
      <div className="comment-compose">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="分享你的看法，友善交流…" maxLength={2000} />
        <button className="primary-btn" disabled={busy || !content.trim()} onClick={() => act('comment-save', { targetType, targetId, content }).then(() => setContent(''))}>
          发布评论
        </button>
      </div>
      <div className="comment-list">
        {roots.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)).map(render)}
        {!items.length && <p className="muted">还没有评论，来发表第一条吧。</p>}
      </div>
      {notice && (
        <div className="modal-backdrop" onClick={() => setNotice('')}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="success-mark">✓</div>
            <h3>{notice.includes('失败') || notice.includes('无权') ? '操作未完成' : '操作成功'}</h3>
            <p>{notice}</p>
            <button className="primary-btn" onClick={() => setNotice('')}>
              知道了
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
