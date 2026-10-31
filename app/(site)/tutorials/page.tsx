import Link from 'next/link';
import { readDb } from '@/lib/db';
import { SearchBar } from '@/app/components/SearchBar';
export const dynamic = 'force-dynamic';
export default async function Tutorials({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const db = await readDb();
  const keyword = (sp.q || '').trim().toLocaleLowerCase();
  const guides = db.guides.filter((g) =>
    g.status === 'approved' &&
    (!keyword || [g.title, g.content, g.author, g.gameName, g.category, ...(g.tags || [])].join(' ').toLocaleLowerCase().includes(keyword)),
  );
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">KNOWLEDGE BASE</div>
          <h1>教程中心</h1>
          <p className="subtitle">找到你需要的图文教程与玩家经验，共 {guides.length} 篇。</p>
        </div>
        <Link className="primary-btn" href="/tutorials/submit">
          投稿教程 ↗
        </Link>
      </header>
      <SearchBar action="/tutorials" q={sp.q} />
      <section className="content-grid">
        {guides.map((g) => (
          <Link className="content-card article-tile" href={`/tutorials/${g.id}`} key={g.id}>
            {g.cover && <img className="wide-cover" src={g.cover} alt="" />}
            <div className="tag-row">
              <span className="tag">{g.category}</span>
              <small>{g.gameName || '综合教程'}</small>
            </div>
            <h3>{g.title}</h3>
            <p className="multiline">
              {g.content.slice(0, 180)}
              {g.content.length > 180 ? '…' : ''}
            </p>
            <div className="card-footer">
              <span>
                {g.author || '档案成员'} · {g.date}
                {g.updatedAt ? ` · 更新于 ${new Date(g.updatedAt).toLocaleDateString('zh-CN')}` : ''}
              </span>
              <span>{g.views || 0} 浏览</span>
            </div>
            <span className="subtle-link">阅读全文 →</span>
          </Link>
        ))}
        {!guides.length && <div className="empty-state">暂无已发布教程</div>}
      </section>
    </div>
  );
}
