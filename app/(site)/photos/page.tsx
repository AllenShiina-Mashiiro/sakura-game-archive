import { readDb } from '@/lib/db';
import Link from 'next/link';
import { SearchBar } from '@/app/components/SearchBar';
import { mediaUrl } from '@/lib/media';
export const dynamic = 'force-dynamic';
export default async function Photos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const allPhotos = (await readDb()).photos;
  const keyword = (sp.q || '').trim().toLocaleLowerCase();
  const photos = allPhotos.filter((photo) =>
    !keyword || [photo.title, photo.description, ...(photo.tags || [])].join(' ').toLocaleLowerCase().includes(keyword),
  );
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">WALLPAPER GALLERY</div>
          <h1>照片墙</h1>
          <p className="subtitle">浏览、欣赏并下载社区整理的壁纸与图片；照片墙保留原始分辨率，支持 4K 原图。</p>
        </div>
      </header>
      <SearchBar action="/photos" q={sp.q} />
      <p className="muted">显示 {photos.length} / {allPhotos.length} 张图片</p>
      <div className="photo-wall">
        {photos.map((p) => (
          <article className="photo-card" key={p.id}>
            <a href={mediaUrl(p.image)} target="_blank" rel="noreferrer">
              <img src={mediaUrl(p.image)} alt={p.title} />
            </a>
            <div>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
              <div className="tag-row">
                {p.tags.map((t) => (
                  <Link className="tag" href={`/tags/${encodeURIComponent(t)}`} key={t}>
                    {t}
                  </Link>
                ))}
              </div>
              <a className="outline-btn" href={mediaUrl(p.image)} download>
                下载原图 ↓
              </a>
            </div>
          </article>
        ))}
        {!photos.length && <div className="empty-state">照片墙还没有图片，管理员发布后会显示在这里。</div>}
      </div>
    </div>
  );
}
