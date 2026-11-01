import Link from 'next/link';
import { readDb } from '@/lib/db';
import { FavoriteButton } from '@/app/components/ActionForm';
import { SearchBar } from '@/app/components/SearchBar';
import { mediaUrl } from '@/lib/media';
export const dynamic = 'force-dynamic';
export default async function Resources({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; type?: string; platform?: string }> }) {
  const sp = await searchParams;
  const db = await readDb();
  const norm = (x: string) => x.toLocaleLowerCase();
  const resources = db.resources.filter((r) => {
    const game = db.games.find((g) => g.id === r.gameId);
    return (
      (!sp.q || norm([r.title, r.description, r.gameName, ...r.tags].join(' ')).includes(norm(sp.q))) &&
      (!sp.tag || r.tags.some((t) => norm(t).includes(norm(sp.tag!)))) &&
      (!sp.type || norm(r.scope).includes(norm(sp.type))) &&
      (!sp.platform || (game?.platforms || []).some((x) => norm(x).includes(norm(sp.platform!))))
    );
  });
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">TOOLS / PATCHES / EXTENSIONS</div>
          <h1>拓展资源</h1>
          <p className="subtitle">补丁、工具、插件与其他游戏扩展资料。</p>
        </div>
      </header>
      <SearchBar action="/resources" q={sp.q} tag={sp.tag} type={sp.type} platform={sp.platform} />
      <div className="content-grid">
        {resources.map((r) => (
          <article className="content-card" key={r.id}>
            {r.cover && (
              <Link href={`/resources/${r.id}`}>
                <img className="wide-cover" src={mediaUrl(r.cover)} alt="" />
              </Link>
            )}
            <small>
              {r.gameName} · {r.version}
            </small>
            <h3>
              <Link href={`/resources/${r.id}`}>{r.title}</Link>
            </h3>
            <p>{r.description}</p>
            <div className="tag-row">
              {r.tags.map((t) => (
                <Link className="tag" href={`/tags/${encodeURIComponent(t)}`} key={t}>
                  {t}
                </Link>
              ))}
            </div>
            <FavoriteButton targetType="resource" targetId={r.id} />
          </article>
        ))}
        {!resources.length && <div className="empty-state">暂无拓展资源，后续由管理员整理发布。</div>}
      </div>
    </div>
  );
}
