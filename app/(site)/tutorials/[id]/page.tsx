import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ImageViewer } from '@/app/components/ImageViewer';
import { readDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { CommentSection } from '@/app/components/CommentSection';
import { FavoriteButton } from '@/app/components/ActionForm';
import { GuideEditForm } from '@/app/components/GuideEditForm';
import { mediaUrl } from '@/lib/media';
export const dynamic = 'force-dynamic';
export default async function TutorialDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [db, user] = await Promise.all([readDb(), getSessionUser()]);
  const g = db.guides.find((x) => x.id === id && x.status === 'approved');
  if (!g) notFound();
  const canEdit = !!user && (user.id === g.userId || user.role === 'admin');
  return (
    <div className="page-wrap article-page">
      <Link className="back-link" href="/tutorials">
        ← 返回教程中心
      </Link>
      {g.cover && <img className="article-cover" src={mediaUrl(g.cover)} alt="" />}
      <div className="eyebrow">TUTORIAL / {g.category}</div>
      <h1>{g.title}</h1>
      <p className="subtitle">
        {g.author || '档案成员'} · 发布于 {g.date}
        {g.updatedAt && ` · 最后修改 ${new Date(g.updatedAt).toLocaleString('zh-CN')}`} · {g.views || 0} 次浏览
      </p>
      <div className="article-body">
        {g.content.split(/\n{2,}/).map((part, i) => (
          <p key={i}>{part}</p>
        ))}
      </div>
      {(g.bodyImages?.length ? g.bodyImages : g.bodyImage ? [g.bodyImage] : []).length > 0 && (
        <div className="article-image-gallery">
          {(g.bodyImages?.length ? g.bodyImages : g.bodyImage ? [g.bodyImage] : []).map((src, i) => (
            <ImageViewer key={i} src={src} alt={`教程配图 ${i + 1}`} className="article-inline-image" />
          ))}
        </div>
      )}
      <div className="detail-actions">
        <FavoriteButton targetType="guide" targetId={g.id} />
      </div>
      {canEdit && (
        <section className="detail-section">
          <h2>教程管理</h2>
          <p className="muted">教程作者和管理员可以修改本教程。</p>
          <GuideEditForm guide={g} games={db.games.map((x) => ({ id: x.id, name: x.name }))} />
        </section>
      )}
      <CommentSection targetType="guide" targetId={g.id} />
    </div>
  );
}
