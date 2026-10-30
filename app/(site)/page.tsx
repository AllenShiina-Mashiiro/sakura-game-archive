import Link from 'next/link';
import { readDb } from '@/lib/db';
import { GameCard } from './components/GameCard';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const db = await readDb();
  const updates = db.games.reduce((n, g) => n + g.updates.length, 0);
  const notices = db.notices.filter((n) => n.published).slice(0, 3);
  return (
    <div className="page-wrap home-page" style={db.siteSettings?.background ? { backgroundImage: `url("${db.siteSettings.background}")` } : undefined}>
      <header className="topbar">
        <div>
          <div className="eyebrow">GAME ARCHIVE / COMMUNITY</div>
          <h1>AllenShiina的游戏档案库</h1>
          <p className="subtitle">整理游戏资料、分享实用教程，让每一份经验都有迹可循。</p>
        </div>
        <div className="hero-actions">
          <Link className="primary-btn" href="/games">
            探索档案 ↗
          </Link>
          <Link className="outline-btn" href="/photos">
            照片墙
          </Link>
        </div>
      </header>
      <section
        className="hero-panel"
        style={
          db.siteSettings?.homeBackground
            ? {
                backgroundImage: `url("${db.siteSettings.homeBackground}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="hero-copy">
          <span className="overline">YOUR GAME KNOWLEDGE BASE</span>
          <h2>
            把热爱整理成
            <br />
            可追溯的资料
          </h2>
          <p>游戏档案、版本记录、图文教程与拓展资源，集中管理与分享。</p>
          <div className="hero-actions">
            <Link className="primary-btn" href="/games">
              浏览游戏档案 →
            </Link>
            <Link className="text-btn" href="/tutorials">
              进入教程中心
            </Link>
          </div>
        </div>
        <div className="hero-art">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-symbol">
            {db.siteSettings?.heroLogo ? (
              <img src={db.siteSettings.heroLogo} alt="首页品牌标识" />
            ) : (
              <>
                G<span>+</span>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="stats-grid">
        <Stat label="收录游戏" value={db.games.length} />
        <Stat label="版本记录" value={updates} />
        <Stat label="教程文章" value={db.guides.filter((g) => g.status === 'approved').length} />
        <Stat label="拓展资源" value={db.resources.length} />
      </section>
      <section className="section-head">
        <div>
          <div className="eyebrow">GAME COLLECTION</div>
          <h2>游戏档案</h2>
          <p>查看游戏版本、资源清单和关联资料。</p>
        </div>
        <Link className="subtle-link" href="/games">
          查看全部 →
        </Link>
      </section>
      <div className="game-grid">
        {db.games.slice(0, 6).map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </div>
      <section className="section-head">
        <div>
          <div className="eyebrow">NOTICE BOARD</div>
          <h2>公告牌</h2>
        </div>
        <Link className="subtle-link" href="/notices">
          全部公告 →
        </Link>
      </section>
      <div className="content-grid">
        {notices.map((n) => (
          <Link className="content-card" href={`/notices/${n.id}`} key={n.id}>
            {n.cover && <img className="wide-cover" src={n.cover} alt="" />}
            <small>{n.date}</small>
            <h3>{n.title}</h3>
            <p>{n.subtitle}</p>
            <span className="subtle-link">查看公告 →</span>
          </Link>
        ))}
        {!notices.length && <div className="empty-state">暂无公告</div>}
      </div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">◈</span>
      </div>
      <strong>{String(value).padStart(2, '0')}</strong>
      <small>当前收录</small>
    </div>
  );
}
