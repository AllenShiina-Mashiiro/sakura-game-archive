'use client';
import { useState } from 'react';
import { mediaUrl } from '@/lib/media';
export function ImageUploadField({ name, label = '上传图片', folder = 'content', initial = '', maxSizeMB }: { name: string; label?: string; folder?: string; initial?: string; maxSizeMB?: number }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('image', file);
      fd.set('folder', folder);
      const r = await fetch('/api/upload/content', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '上传失败');
      setUrl(d.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="image-upload-field">
      <label>
        {label}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      <input type="hidden" name={name} value={url} />
      {url && (
        <div className="upload-preview">
          <img src={mediaUrl(url)} alt="图片预览" />
          <button type="button" className="text-btn" onClick={() => setUrl('')}>
            移除图片
          </button>
        </div>
      )}
      {busy && <small>正在上传…</small>}
      {error && <small className="error-text">{error}</small>}
      <small className="muted">JPG / PNG / WEBP / GIF，最大 {maxSizeMB || (folder === 'photos' ? 50 : 8)} MB；照片墙保留原始分辨率</small>
    </div>
  );
}
