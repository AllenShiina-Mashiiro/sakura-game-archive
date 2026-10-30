'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function NoticeEditForm({
  notice,
}: {
  notice: {
    id: string;
    title: string;
    subtitle: string;
    cover: string;
    content: string;
    pinned: boolean;
    published: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notice-save',
          id: notice.id,
          ...data,
          pinned: data.pinned === 'true',
          published: data.published === 'true',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '保存失败');
      setMessage('公告修改成功');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button type="button" className="outline-btn" onClick={() => setOpen((v) => !v)}>
        {open ? '取消' : '修改公告'}
      </button>
      {message && <small>{message}</small>}
      {open && (
        <form className="stack-form" onSubmit={submit}>
          <label>
            标题
            <input name="title" defaultValue={notice.title} required />
          </label>
          <label>
            副标题
            <input name="subtitle" defaultValue={notice.subtitle} />
          </label>
          <label>
            封面 URL
            <input name="cover" defaultValue={notice.cover} />
          </label>
          <label>
            正文
            <textarea name="content" rows={6} defaultValue={notice.content} required />
          </label>
          <label className="check-label">
            <input name="pinned" type="checkbox" value="true" defaultChecked={notice.pinned} /> 置顶
          </label>
          <label className="check-label">
            <input name="published" type="checkbox" value="true" defaultChecked={notice.published} /> 已发布
          </label>
          <button className="primary-btn" disabled={busy}>
            {busy ? '保存中…' : '保存公告'}
          </button>
        </form>
      )}
    </div>
  );
}
