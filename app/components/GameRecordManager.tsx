'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Game } from '@/lib/types';

export function GameRecordManager({ game }: { game: Pick<Game, 'id' | 'updates' | 'files'> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function save(e: React.FormEvent<HTMLFormElement>, kind: 'update' | 'file', id: string) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'game-record', gameId: game.id, kind, id, ...values }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function remove(kind: 'update' | 'file', id: string) {
    if (!confirm('确定删除这条记录吗？删除后无法恢复。')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'game-record-delete', gameId: game.id, kind, id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '删除失败');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="admin-form-panel game-record-manager">
      <summary>管理版本记录（{game.updates.length}）和资源文件（{game.files.length}）</summary>
      {error && <p className="error-box">{error}</p>}
      <h4>版本更新记录</h4>
      {game.updates.map((item) => (
        <div className="admin-row" key={item.id}>
          {editing === item.id ? (
            <form className="stack-form" onSubmit={(e) => save(e, 'update', item.id)}>
              <label>日期<input name="date" type="date" defaultValue={item.date} required /></label>
              <label>版本号<input name="version" defaultValue={item.version} required /></label>
              <label>更新标题<input name="title" defaultValue={item.title} required /></label>
              <label>更新内容<textarea name="notes" defaultValue={item.notes} rows={3} /></label>
              <button className="primary-btn" disabled={busy}>保存版本修改</button>
              <button type="button" className="outline-btn" onClick={() => setEditing(null)}>取消</button>
            </form>
          ) : (
            <>
              <div><b>{item.title} · {item.version}</b><small>{item.date} · {item.notes}</small></div>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => setEditing(item.id)}>修改</button>
              <button type="button" className="outline-btn danger-outline" disabled={busy} onClick={() => remove('update', item.id)}>删除</button>
            </>
          )}
        </div>
      ))}
      {!game.updates.length && <p className="muted">暂无版本记录。</p>}
      <h4>资源文件清单</h4>
      {game.files.map((item) => (
        <div className="admin-row" key={item.id}>
          {editing === item.id ? (
            <form className="stack-form" onSubmit={(e) => save(e, 'file', item.id)}>
              <label>资源名称<input name="name" defaultValue={item.name} required /></label>
              <label>版本<input name="version" defaultValue={item.version} /></label>
              <label>文件大小<input name="size" defaultValue={item.size} /></label>
              <label>校验值<input name="checksum" defaultValue={item.checksum} /></label>
              <label>日期<input name="date" type="date" defaultValue={item.date} required /></label>
              <label>下载地址<input name="url" type="url" defaultValue={item.url || ''} /></label>
              <label>备注 / 网盘链接<textarea name="notes" rows={3} defaultValue={item.notes} /></label>
              <button className="primary-btn" disabled={busy}>保存资源修改</button>
              <button type="button" className="outline-btn" onClick={() => setEditing(null)}>取消</button>
            </form>
          ) : (
            <>
              <div><b>{item.name} · {item.version || '未注明版本'}</b><small>{item.date} · {item.size || '大小未注明'} · {item.url || item.notes}</small></div>
              <button type="button" className="outline-btn" disabled={busy} onClick={() => setEditing(item.id)}>修改</button>
              <button type="button" className="outline-btn danger-outline" disabled={busy} onClick={() => remove('file', item.id)}>删除</button>
            </>
          )}
        </div>
      ))}
      {!game.files.length && <p className="muted">暂无资源文件。</p>}
    </details>
  );
}
