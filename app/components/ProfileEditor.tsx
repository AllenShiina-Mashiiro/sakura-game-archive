'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mediaUrl } from '@/lib/media';
export function ProfileEditor({ nickname, avatar, selectedBadge, avatarFrame, cardBackground, badges }: { nickname: string; avatar: string; selectedBadge: string; avatarFrame: string; cardBackground: string; badges: string[] }) {
  const [name, setName] = useState(nickname);
  const [image, setImage] = useState(avatar || '');
  const [file, setFile] = useState<File | null>(null);
  const [badge, setBadge] = useState(selectedBadge);
  const [frame, setFrame] = useState(avatarFrame);
  const [background, setBackground] = useState(cardBackground);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      let nextAvatar = image;
      if (file) {
        const fd = new FormData();
        fd.append('avatar', file);
        const up = await fetch('/api/upload/avatar', { method: 'POST', body: fd });
        const ud = await up.json();
        if (!up.ok) throw new Error(ud.error || '头像上传失败');
        nextAvatar = ud.url;
      }
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'profile',
          nickname: name,
          avatar: nextAvatar,
          selectedBadge: badge,
          avatarFrame: frame,
          cardBackground: background,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setImage(nextAvatar);
      setFile(null);
      setOk('个人资料与装饰已保存');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack-form" onSubmit={submit}>
      <label>
        昵称
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
      </label>
      <label>
        头像图片（JPG / PNG / WEBP / GIF，最大 4 MB）
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      <div className="avatar-preview-row">
        <span className={`avatar avatar-large avatar-frame-${frame}`}>{image ? <img src={mediaUrl(image)} alt="头像预览" /> : name.slice(0, 1)}</span>
        <small>{file ? `待上传：${file.name}` : image ? '当前头像' : '尚未设置头像'}</small>
      </div>
      <label>
        佩戴徽章
        <select value={badge} onChange={(e) => setBadge(e.target.value)}>
          <option value="">不佩戴</option>
          {badges.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
      </label>
      <label>
        头像框
        <select value={frame} onChange={(e) => setFrame(e.target.value)}>
          <option value="none">默认头像框</option>
          <option value="sakura">樱花头像框</option>
          <option value="gold">鎏金头像框</option>
          <option value="glass">液态玻璃头像框</option>
        </select>
      </label>
      <label>
        个人名片背景图片 URL
        <input type="url" value={background} onChange={(e) => setBackground(e.target.value)} placeholder="https://..." />
      </label>
      <label>
        或上传名片背景图片（最大 8 MB）
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const fd = new FormData();
            fd.set('image', f);
            fd.set('folder', 'profile-cards');
            const up = await fetch('/api/upload/content', { method: 'POST', body: fd });
            const d = await up.json();
            if (!up.ok) {
              setError(d.error || '背景上传失败');
              return;
            }
            setBackground(d.url);
            setError('');
          }}
        />
      </label>
      {background && (
        <div className="upload-preview">
          <img src={mediaUrl(background)} alt="名片背景预览" />
        </div>
      )}
      {error && <div className="error-box">{error}</div>}
      {ok && <div className="success-inline">{ok}</div>}
      <button className="primary-btn" disabled={busy}>
        {busy ? '保存中…' : '保存资料与装饰'}
      </button>
    </form>
  );
}
