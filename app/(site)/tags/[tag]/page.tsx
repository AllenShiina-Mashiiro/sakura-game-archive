import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = decodeURIComponent(raw);
  const db = await readDb();
  const games = db.games.filter((g) => g.tags.includes(tag));
  const resources = db.resources.filter((r) => r.tags.includes(tag));
  const guides = db.guides.filter((g) => g.status === 'approved' && g.category === tag);
  if (!games.length && !resources.length && !guides.length) notFound();
  return (
    <div className="page-wrap">
      <Link className="back-link" href="/games">
        ← 返回档案
      </Link>
      <div className="eyebrow">TAG COLLECTION</div>
      <h1>#{tag}</h1>
      <p className="subtitle">所有使用该标签的游戏、拓展资源与教程。</p>
      <section className="detail-section">
        <h2>游戏档案 · {games.length}</h2>
        <div className="content-grid">
          {games.map((g) => (
            <Link className="content-card" key={g.id} href={`/games/${g.slug}`}>
              <img className="wide-cover" src={g.cover || '/placeholder-cover.svg'} alt="" />
              <h3>{g.name}</h3>
              <p>
                {g.genre} · {g.platforms.join(' / ')}
              </p>
            </Link>
          ))}
        </div>
      </section>
      <section className="detail-section">
        <h2>拓展资源 · {resources.length}</h2>
        <div className="content-grid">
          {resources.map((r) => (
            <Link className="content-card" key={r.id} href={`/resources/${r.id}`}>
              <h3>{r.title}</h3>
              <p>{r.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="detail-section">
        <h2>教程 · {guides.length}</h2>
        <div className="content-grid">
          {guides.map((g) => (
            <Link className="content-card" key={g.id} href={`/tutorials/${g.id}`}>
              <h3>{g.title}</h3>
              <p>{g.author}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
