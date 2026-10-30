'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AdminDeleteButton({ action, id, label = '删除' }: { action: string; id: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function remove() {
    if (!confirm(`确定要${label}吗？此操作不可撤销。`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '操作失败');
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className="outline-btn danger-outline" disabled={busy} onClick={remove}>
      {busy ? '处理中…' : label}
    </button>
  );
}
