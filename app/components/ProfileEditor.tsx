'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mediaUrl } from '@/lib/media';
import { uploadImageDirect } from '@/lib/upload-image';
import { ImageCropUpload } from '@/app/components/ImageCropUpload';
export function ProfileEditor({ nickname, avatar, selectedBadge, avatarFrame, cardBackground, badges }: { nickname: string; avatar: string; selectedBadge: string; avatarFrame: string; cardBackground: string; badges: string[] }) {
  const [name, setName] = useState(nickname);
  const [image, setImage] = useState(avatar || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [badge, setBadge] = useState(selectedBadge);
  const [frame, setFrame] = useState(avatarFrame);
  const [background, setBackground] = useState(cardBackground);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const form = e.currentTarget;
    if (form.querySelector('[data-cropping="true"]')) {
      setError('裁剪图片仍在生成，请稍后再保存。');
      return;
    }
    setBusy(true);
    setError('');
    setOk('');
    try {
      let nextAvatar = image;
      if (avatarFile) {
        nextAvatar = await uploadImageDirect(avatarFile, 'avatars');
      }
      let nextBackground = background;
      if (cardFile) {
        nextBackground = await uploadImageDirect(cardFile, 'profile-cards');
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
          cardBackground: nextBackground,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setImage(nextAvatar);
      setAvatarFile(null);
      setCardFile(null);
      setBackground(nextBackground);
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
      <ImageCropUpload
        label="头像图片裁剪（正方形，最大 4 MB）"
        aspectRatio={1}
        maxSizeMB={4}
        onCrop={(croppedFile, preview) => {
          setAvatarFile(croppedFile);
          setImage(preview);
        }}
      />
      <div className="avatar-preview-row">
        <span className={`avatar avatar-large avatar-frame-${frame}`}>{image ? <img src={mediaUrl(image)} alt="头像预览" /> : name.slice(0, 1)}</span>
        <small>{avatarFile ? `已裁剪：${avatarFile.name}` : image ? '当前头像' : '尚未设置头像'}</small>
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
        <input type="url" value={background} onChange={(e) => { setBackground(e.target.value); setCardFile(null); }} placeholder="https://..." />
      </label>
      <ImageCropUpload
        label="名片背景裁剪（宽屏 16:5，最大 8 MB）"
        aspectRatio={16 / 5}
        maxSizeMB={8}
        onCrop={(croppedFile, preview) => {
          setCardFile(croppedFile);
          setBackground(preview);
          setError('');
        }}
      />
      {background && (
        <div className="upload-preview">
          <img src={mediaUrl(background)} alt="名片背景预览" />
        </div>
      )}
      {error && <div className="error-box">{error}</div>}
      {ok && <div className="success-inline">{ok}</div>}
      <button className="primary-btn" disabled={busy}>
        {busy ? '保存中…（图片直传中）' : '保存资料与装饰'}
      </button>
    </form>
  );
}
