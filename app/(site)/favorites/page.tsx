import Link from 'next/link';
import { and, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/postgres';
import { collections, games, guides, resources } from '@/drizzle/schema';
import { getSessionUser } from '@/lib/auth';
import { SearchBar } from '@/app/components/SearchBar';
export const dynamic = 'force-dynamic';
export default async function Favorites({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const keyword = (sp.q || '').trim();
  const rows = user ? await db.select().from(collections)
    .where(eq(collections.userId, user.id)).orderBy(collections.createdAt) : [];
  const [gameRows, guideRows, resourceRows] = await Promise.all([
    db.select().from(games), db.select().from(guides), db.select().from(resources),
  ]);
  const gameMap = new Map(gameRows.map((x) => [x.id, x]));
  const guideMap = new Map(guideRows.map((x) => [x.id, x]));
  const resourceMap = new Map(resourceRows.map((x) => [x.id, x]));
  const items = rows.map((c) => {
    const target = c.targetType === 'game' ? gameMap.get(c.targetId) : c.targetType === 'guide' ? guideMap.get(c.targetId) : resourceMap.get(c.targetId);
    const title = target ? ('name' in target ? target.name : target.title) : '已删除内容';
    return { collection: c, target, title };
  }).filter(({ collection: c, title }) => !keyword || [title, c.targetType, c.targetId].join(' ').toLocaleLowerCase().includes(keyword.toLocaleLowerCase()));
  return (
    <div className="page-wrap">
      <header className="topbar"><div><div className="eyebrow">YOUR COLLECTION</div><h1>个人收藏</h1><p className="subtitle">你收藏的游戏、教程和拓展资源。</p></div></header>
      <SearchBar action="/favorites" q={sp.q} />
      <div className="content-grid">
        {items.map(({ collection: c, target, title }) => {
          const href = c.targetType === 'game' && target && 'slug' in target ? `/games/${target.slug}` : c.targetType === 'guide' ? '/tutorials' : '/resources';
          return <article className="content-card" key={c.id}><small>{c.targetType === 'game' ? '游戏档案' : c.targetType === 'guide' ? '教程' : '拓展资源'}</small><h3>{title}</h3><Link href={href}>查看内容 →</Link></article>;
        })}
        {!items.length && <div className="empty-state">还没有收藏内容。</div>}
      </div>
    </div>
  );
}
