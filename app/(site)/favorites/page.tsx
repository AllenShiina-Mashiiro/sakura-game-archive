import Link from 'next/link';
import { readDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { SearchBar } from '@/app/components/SearchBar';
export const dynamic = 'force-dynamic';
export default async function Favorites({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const [db, user] = await Promise.all([readDb(), getSessionUser()]);
  const keyword = (sp.q || '').trim().toLocaleLowerCase();
  const items = db.collections.filter((c) => {
    if (c.userId !== user?.id) return false;
    const target = c.targetType === 'game' ? db.games.find((x) => x.id === c.targetId) : c.targetType === 'guide' ? db.guides.find((x) => x.id === c.targetId) : db.resources.find((x) => x.id === c.targetId);
    const title = target ? ('name' in target ? target.name : target.title) : '已删除内容';
    return !keyword || [title, c.targetType, c.targetId].join(' ').toLocaleLowerCase().includes(keyword);
  });
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">YOUR COLLECTION</div>
          <h1>个人收藏</h1>
          <p className="subtitle">你收藏的游戏、教程和拓展资源。</p>
        </div>
      </header>
      <SearchBar action="/favorites" q={sp.q} />
      <div className="content-grid">
        {items.map((c) => {
          const target = c.targetType === 'game' ? db.games.find((x) => x.id === c.targetId) : c.targetType === 'guide' ? db.guides.find((x) => x.id === c.targetId) : db.resources.find((x) => x.id === c.targetId);
          const title = target ? ('name' in target ? target.name : target.title) : '已删除内容';
          const href = c.targetType === 'game' && target && 'slug' in target ? `/games/${target.slug}` : c.targetType === 'guide' ? '/tutorials' : '/resources';
          return (
            <article className="content-card" key={c.id}>
              <small>{c.targetType === 'game' ? '游戏档案' : c.targetType === 'guide' ? '教程' : '拓展资源'}</small>
              <h3>{title}</h3>
              <Link href={href}>查看内容 →</Link>
            </article>
          );
        })}
        {!items.length && <div className="empty-state">还没有收藏内容。</div>}
      </div>
    </div>
  );
}
