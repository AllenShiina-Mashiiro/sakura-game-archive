'use client';
import { useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { uploadImageDirect } from '@/lib/upload-image';

export function ImageUploadField({ name, label = '上传图片', folder = 'content', initial = '', maxSizeMB }: { name: string; label?: string; folder?: string; initial?: string; maxSizeMB?: number }) {
  const [url, setUrl] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const limit = maxSizeMB ?? (folder === 'photos' ? 50 : 12);
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > limit * 1024 * 1024) {
      setError(`图片不能超过 ${limit} MB`);
      return;
    }
    setBusy(true);
    setProgress(0);
    setError('');
    try {
      const nextUrl = await uploadImageDirect(file, folder, (uploaded, total) => {
        setProgress(total > 0 ? Math.round((uploaded / total) * 100) : 0);
      });
      setUrl(nextUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="image-upload-field" data-uploading={busy ? "true" : "false"}>
      <label>
        {label}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          void upload(file);
        }} />
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
      {busy && <><progress className="upload-progress" value={progress} max={100} /><small>正在直传 Supabase Storage… {progress}%</small></>}
      {error && <small className="error-text">{error}</small>}
      <small className="muted">JPG / PNG / WEBP / GIF，最大 {limit} MB；照片墙保留原始分辨率</small>
    </div>
  );
}
