'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MultiImageUploadField } from '@/app/components/MultiImageUploadField';
export function GuideEditForm({
  guide,
  games,
}: {
  guide: {
    id: string;
    title: string;
    category: string;
    gameId?: string;
    content: string;
    cover?: string;
    bodyImage?: string;
    bodyImages?: string[];
  };
  games: { id: string; name: string }[];
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
        body: JSON.stringify({ action: 'guide-edit', id: guide.id, ...data }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '修改失败');
      setMessage('教程修改成功');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '修改失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="guide-edit">
      <button className="outline-btn" type="button" onClick={() => setOpen((v) => !v)}>
        {open ? '取消编辑' : '修改教程'}
      </button>
      {message && <small>{message}</small>}
      {open && (
        <form className="stack-form" onSubmit={submit}>
          <label>
            教程标题
            <input name="title" defaultValue={guide.title} minLength={3} required />
          </label>
          <label>
            关联游戏
            <select name="gameId" defaultValue={guide.gameId || ''}>
              <option value="">综合教程</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            分类
            <input name="category" defaultValue={guide.category} />
          </label>
          <label>
            封面图片 URL
            <input name="cover" defaultValue={guide.cover || ''} />
          </label>
          <MultiImageUploadField name="bodyImages" label="教程正文图片" folder="tutorials" initial={guide.bodyImages?.length ? guide.bodyImages : guide.bodyImage ? [guide.bodyImage] : []} />
          <label>
            正文
            <textarea name="content" rows={10} minLength={20} defaultValue={guide.content} required />
          </label>
          <button className="primary-btn" disabled={busy}>
            {busy ? '保存中…' : '保存修改'}
          </button>
        </form>
      )}
    </div>
  );
}
