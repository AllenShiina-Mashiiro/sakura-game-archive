import { notFound } from 'next/navigation';
import Link from 'next/link';
import { readDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { LinkifiedText } from '@/app/components/LinkifiedText';
import { FavoriteButton } from '../../../components/ActionForm';
import { CommentSection } from '@/app/components/CommentSection';
export const dynamic = 'force-dynamic';
export default async function GameDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [db, user] = await Promise.all([readDb(), getSessionUser()]);
  const game = db.games.find((g) => g.slug === slug);
  if (!game) notFound();
  const legacyGuides = game.guides || [];
  const linkedGuides = db.guides.filter((g) => g.gameId === game.id && g.status === 'approved');
  const guideMap = new Map([...legacyGuides, ...linkedGuides].map((g) => [g.id, g]));
  const gameGuides = [...guideMap.values()];
  const isAdmin = user?.role === 'admin';
  return (
    <div className="page-wrap detail-page">
      <Link className="back-link" href="/games">
        ← 返回游戏档案
      </Link>
      <section className="detail-hero">
        <img src={game.cover || '/placeholder-cover.svg'} alt={`${game.name}封面`} />
        <div className="detail-shade" />
        <div className="detail-hero-content">
          <span className="overline">GAME PROFILE / {game.slug.toUpperCase()}</span>
          <h1>{game.name}</h1>
          <p>{game.description}</p>
          <div className="tag-row">
            {game.tags.map((tag) => (
              <Link className="tag tag-light" href={`/tags/${encodeURIComponent(tag)}`} key={tag}>
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </section>
      <div className="detail-actions">
        <FavoriteButton targetType="game" targetId={game.id} />
        <span className="muted">
          {game.views || 0} 次浏览 · {game.favorites || 0} 次收藏
        </span>
      </div>
      <div className="detail-meta-grid">
        <Meta label="最新版本" value={game.latestVersion || '未记录'} />
        <Meta label="最近更新" value={game.updatedAt || '暂无'} />
        <Meta label="游戏类型" value={game.genre || '未分类'} />
        <Meta label="运行平台" value={game.platforms.join(' / ') || '未记录'} />
      </div>
      <section className="detail-section">
        <div className="section-head compact">
          <div>
            <div className="eyebrow">VERSION HISTORY</div>
            <h2>
              版本更新记录 <span className="count-badge">{game.updates.length}</span>
            </h2>
          </div>
        </div>
        {game.updates.length ? (
          <div className="timeline">
            {[...game.updates]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((update) => (
                <article className="timeline-item" key={update.id}>
                  <div className="timeline-date">{update.date}</div>
                  <div className="timeline-marker" />
                  <div className="timeline-content">
                    <div className="timeline-title">
                      <h3>{update.title}</h3>
                      <code>{update.version}</code>
                    </div>
                    <p>{update.notes}</p>
                  </div>
                </article>
              ))}
          </div>
        ) : (
          <Empty text="还没有版本更新记录。" />
        )}
      </section>
      <section className="detail-section">
        <div className="section-head compact">
          <div>
            <div className="eyebrow">SYSTEM REQUIREMENTS</div>
            <h2>运行配置</h2>
          </div>
        </div>
        <div className="detail-meta-grid">
          <Meta label="最低配置" value={game.config?.minimum || '暂未填写'} />
          <Meta label="推荐配置" value={game.config?.recommended || '暂未填写'} />
        </div>
      </section>
      <section className="detail-section">
        <div className="section-head compact">
          <div>
            <div className="eyebrow">RESOURCE FILES</div>
            <h2>
              资源文件清单 <span className="count-badge">{game.files.length}</span>
            </h2>
          </div>
        </div>
        {game.files.length ? (
          <div className="table-card resource-table">
            <div className="table-head resource-head">
              <span>文件 / 资源名称</span>
              <span>版本</span>
              <span>大小</span>
              <span>记录日期</span>
            </div>
            {game.files.map((file) => (
              <div className="resource-row" key={file.id}>
                <span>
                  <b>{file.name}</b>
                  <small><LinkifiedText text={file.notes || ''} /></small>
                  {file.url && /^https?:\\/\\//i.test(file.url) && <a className="resource-download-link" href={file.url} target="_blank" rel="noopener noreferrer">打开下载链接 ↗</a>}
                  {file.checksum && file.checksum !== '待填写' && <code className="checksum">SHA / MD5: {file.checksum}</code>}
                </span>
                <code>{file.version || '—'}</code>
                <span>{file.size || '—'}</span>
                <time>{file.date || '—'}</time>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="还没有资源文件记录。" />
        )}
      </section>
      <section className="detail-section">
        <div className="section-head compact">
          <div>
            <div className="eyebrow">KNOWLEDGE BASE</div>
            <h2>
              攻略与开发者说明 <span className="count-badge">{gameGuides.length}</span>
            </h2>
          </div>
        </div>
        {isAdmin && <Link className="outline-btn" href="/admin?section=tutorials">管理攻略 / 开发者说明 ↗</Link>}
        {gameGuides.length ? (
          <div className="guide-grid">
            {gameGuides.map((guide) => (
              <article className="guide-card" key={guide.id}>
                <span className="tag">{guide.category}</span>
                <time>{guide.date}</time>
                <h3><Link href={`/tutorials/${guide.id}`}>{guide.title} ↗</Link></h3>
                <p><LinkifiedText text={guide.content} /></p>
              </article>
            ))}
          </div>
        ) : (
          <Empty text="还没有文章或公告记录。" />
        )}
      </section>
      <CommentSection targetType="game" targetId={game.id} />
      <div className="detail-bottom">
        <span>资料由个人档案库维护，示例数据请自行核实。</span>
        {isAdmin && <Link className="primary-btn" href="/admin?section=games">
          编辑档案 ↗
        </Link>}
      </div>
    </div>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-meta">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-inline">
      {text} <Link href="/admin">前往管理后台添加 →</Link>
    </div>
  );
}
