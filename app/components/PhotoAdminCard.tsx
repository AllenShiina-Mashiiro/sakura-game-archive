'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mediaUrl } from '@/lib/media';
export function PhotoAdminCard({ id, title, image }: { id: string; title: string; image: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function remove() {
    if (!confirm(`确定删除「${title}」吗？`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'photo-delete', id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || '删除失败');
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-row">
      <img className="admin-photo-thumb" src={mediaUrl(image)} alt="" />
      <b>{title}</b>
      <button className="outline-btn" disabled={busy} onClick={remove}>
        {busy ? '删除中…' : '删除'}
      </button>
    </div>
  );
}
