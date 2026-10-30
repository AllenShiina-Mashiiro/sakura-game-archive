import { notFound } from 'next/navigation';
import Link from 'next/link';
import { readDb } from '@/lib/db';
import { CommentSection } from '@/app/components/CommentSection';
import { FavoriteButton } from '@/app/components/ActionForm';
export const dynamic = 'force-dynamic';
export default async function ResourceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = (await readDb()).resources.find((x) => x.id === id);
  if (!r) notFound();
  return (
    <div className="page-wrap article-page">
      <Link className="back-link" href="/resources">
        ← 返回拓展资源
      </Link>
      {r.cover && <img className="article-cover" src={r.cover} alt="" />}
      <div className="eyebrow">EXTENSION RESOURCE</div>
      <h1>{r.title}</h1>
      <p className="subtitle">
        {r.gameName || '通用资源'} · {r.version} · 更新于 {r.updatedAt}
      </p>
      <div className="detail-meta-grid">
        <div className="detail-meta">
          <small>适用范围</small>
          <strong>{r.scope || '未注明'}</strong>
        </div>
        <div className="detail-meta">
          <small>关联游戏</small>
          <strong>{r.gameName || '通用'}</strong>
        </div>
      </div>
      <div className="article-body">
        <h2>资源说明</h2>
        <p>{r.description}</p>
        <h2>安装方式</h2>
        <p>{r.install}</p>
        {r.tutorial && (
          <>
            <h2>相关教程</h2>
            <p>{r.tutorial}</p>
          </>
        )}
        {r.url && (
          <a className="primary-btn" href={r.url} target="_blank" rel="noreferrer">
            打开下载 / 资源链接 ↗
          </a>
        )}
      </div>
      <div className="tag-row">
        {r.tags.map((t) => (
          <Link className="tag" href={`/tags/${encodeURIComponent(t)}`} key={t}>
            {t}
          </Link>
        ))}
      </div>
      <FavoriteButton targetType="resource" targetId={r.id} />
      <CommentSection targetType="resource" targetId={r.id} />
    </div>
  );
}
