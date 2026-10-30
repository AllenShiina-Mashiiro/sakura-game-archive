import { readDb } from '@/lib/db';
import { GameCard } from '../components/GameCard';
import { SearchBar } from '@/app/components/SearchBar';
export const dynamic = 'force-dynamic';
export default async function Games({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; type?: string; platform?: string }> }) {
  const sp = await searchParams;
  const { games } = await readDb();
  const norm = (x: string) => x.toLocaleLowerCase();
  const filtered = games.filter(
    (g) =>
      (!sp.q || norm([g.name, g.description, ...g.tags].join(' ')).includes(norm(sp.q))) &&
      (!sp.tag || g.tags.some((t) => norm(t).includes(norm(sp.tag!)))) &&
      (!sp.type || norm(g.genre).includes(norm(sp.type))) &&
      (!sp.platform || g.platforms.some((p) => norm(p).includes(norm(sp.platform!)))),
  );
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">LIBRARY / ALL GAMES</div>
          <h1>游戏档案</h1>
          <p className="subtitle">
            共收录 {filtered.length} / {games.length} 款游戏。
          </p>
        </div>
      </header>
      <SearchBar q={sp.q} tag={sp.tag} type={sp.type} platform={sp.platform} />
      <div className="game-grid game-grid-all">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      {!filtered.length && <div className="empty-state">没有找到符合条件的游戏，试试其他关键词。</div>}
    </div>
  );
}
