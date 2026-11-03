import Link from 'next/link';
import { asc, inArray } from 'drizzle-orm';
import { db } from '@/lib/postgres';
import { games, resources, resourceImages } from '@/drizzle/schema';
import { FavoriteButton } from '@/app/components/ActionForm';
import { SearchBar } from '@/app/components/SearchBar';
import { mediaUrl } from '@/lib/media';
import { ImageViewer } from '@/app/components/ImageViewer';
export const dynamic = 'force-dynamic';
export default async function Resources({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; type?: string; platform?: string }> }) {
  const sp = await searchParams;
  const [resourceRows, gameRows] = await Promise.all([db.select().from(resources).orderBy(asc(resources.title)), db.select({ id: games.id, platforms: games.platforms }).from(games)]);
  const gamePlatforms = new Map(gameRows.map((g) => [g.id, g.platforms ?? []]));
  const ids = resourceRows.map((r) => r.id);
  const imageRows = ids.length ? await db.select().from(resourceImages).where(inArray(resourceImages.resourceId, ids)).orderBy(asc(resourceImages.sortOrder)) : [];
  const imagesByResource = new Map<string, string[]>();
  for (const image of imageRows) imagesByResource.set(image.resourceId, [...(imagesByResource.get(image.resourceId) ?? []), image.url]);
  const allResources = resourceRows.map((r) => ({ ...r, tags: r.tags ?? [], images: imagesByResource.get(r.id) ?? [] }));
  const norm = (x: string) => x.toLocaleLowerCase();
  const filteredResources = allResources.filter((r) =>
    (!sp.q || norm([r.title, r.description, r.gameName, ...r.tags].join(' ')).includes(norm(sp.q))) &&
    (!sp.tag || r.tags.some((t) => norm(t).includes(norm(sp.tag!)))) &&
    (!sp.type || norm(r.scope).includes(norm(sp.type))) &&
    (!sp.platform || (gamePlatforms.get(r.gameId) ?? []).some((x) => norm(x).includes(norm(sp.platform!))))
  );
  return (
    <div className="page-wrap">
      <header className="topbar"><div><div className="eyebrow">TOOLS / PATCHES / EXTENSIONS</div><h1>拓展资源</h1><p className="subtitle">补丁、工具、插件与其他游戏扩展资料。</p></div></header>
      <SearchBar action="/resources" q={sp.q} tag={sp.tag} type={sp.type} platform={sp.platform} />
      <div className="content-grid">
        {filteredResources.map((r) => (
          <article className="content-card" key={r.id}>
            {r.cover && <Link href={`/resources/${r.id}`}><img className="wide-cover" src={mediaUrl(r.cover)} alt="" /></Link>}
            {!!r.images.length && <div className="review-image-grid resource-list-gallery" aria-label={r.title + '资源配图'}>{r.images.slice(0, 20).map((src, index) => <ImageViewer key={src + '-' + index} src={src} alt={r.title + '配图 ' + (index + 1)} className="review-image" />)}</div>}
            <small>{r.gameName} · {r.version}{r.userId && <> · 贡献者：<Link href={'/users/' + encodeURIComponent(r.userId)}>{r.username || '查看主页'}</Link></>}</small>
            <h3><Link href={`/resources/${r.id}`}>{r.title}</Link></h3><p>{r.description}</p>
            <div className="tag-row">{r.tags.map((t) => <Link className="tag" href={`/tags/${encodeURIComponent(t)}`} key={t}>{t}</Link>)}</div>
            <FavoriteButton targetType="resource" targetId={r.id} />
          </article>
        ))}
        {!filteredResources.length && <div className="empty-state">暂无拓展资源，后续由管理员整理发布。</div>}
      </div>
    </div>
  );
}
