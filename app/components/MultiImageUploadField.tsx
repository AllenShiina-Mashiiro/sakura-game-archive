'use client';
import { useRef, useState } from 'react';
import { mediaUrl } from '@/lib/media';

export function MultiImageUploadField({ name = 'bodyImages', label = '教程正文图片', folder = 'tutorials', initial = [] }: { name?: string; label?: string; folder?: string; initial?: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial.filter(Boolean).slice(0, 20));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const selected = Array.from(files);
    if (urls.length + selected.length > 20) {
      setError(`最多只能保留 20 张图片，目前已有 ${urls.length} 张`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const invalid = selected.find((f) => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type) || f.size > 12 * 1024 * 1024);
    if (invalid) {
      setError(`${invalid.name} 格式不支持或超过 12 MB`);
      return;
    }
    setBusy(true);
    try {
      const uploaded = await Promise.all(
        selected.map(async (file) => {
          const fd = new FormData();
          fd.set('image', file);
          fd.set('folder', folder);
          const res = await fetch('/api/upload/content', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(`${file.name}：${data.error || '上传失败'}`);
          return data.url as string;
        }),
      );
      setUrls((old) => [...old, ...uploaded].slice(0, 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败，请重试');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  return (
    <div className="multi-upload-field">
      <div className="multi-upload-heading">
        <b>{label}</b>
        <span>{urls.length}/20 张</span>
      </div>
      <button type="button" className="multi-upload-picker" onClick={() => inputRef.current?.click()} disabled={busy || urls.length >= 20}>
        {busy ? '正在上传图片…' : '＋ 选择图片（支持多选）'}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <input type="hidden" name={name} value={JSON.stringify(urls)} />
      {urls.length > 0 && (
        <div className="multi-upload-grid">
          {urls.map((url, index) => (
            <div className="multi-upload-item" key={`${url}-${index}`}>
              <img src={mediaUrl(url)} alt={`正文图片 ${index + 1}`} />
              <span>图片 {index + 1}</span>
              <button type="button" onClick={() => setUrls((old) => old.filter((_, i) => i !== index))} aria-label={`移除图片 ${index + 1}`}>
                移除
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      <small className="muted">可按住 Ctrl / Shift 多选，最多 20 张；支持 JPG / PNG / WEBP / GIF，单张最大 12 MB。图片会按图集排版展示。</small>
    </div>
  );
}
