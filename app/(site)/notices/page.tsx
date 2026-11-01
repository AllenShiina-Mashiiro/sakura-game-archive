import Link from 'next/link';
import { readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function Notices() {
  const ns = (await readDb()).notices.filter((n) => n.published).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div><div className="eyebrow">ANNOUNCEMENTS</div><h1>公告牌</h1><p className="subtitle">站点动态、维护通知与重要说明。</p></div>
      </header>
      <div className="content-grid">
        {ns.map((n) => (
          <article className="content-card" key={n.id}>
            <Link href={`/notices/${n.id}`}>
              {n.cover && <img className="wide-cover" src={n.cover} alt="" />}
              <h2>{n.title}</h2><h3>{n.subtitle}</h3>
              <p className="multiline">{n.content.slice(0, 180)}{n.content.length > 180 ? '…' : ''}</p>
              <span className="subtle-link">查看详情 →</span>
            </Link>
            <small>{n.pinned ? '置顶 · ' : ''}{n.date} · 更新者：{n.updatedById ? <Link href={`/users/${encodeURIComponent(n.updatedById)}`}>{n.updatedBy}</Link> : n.updatedBy}</small>
          </article>
        ))}
        {!ns.length && <div className="empty-state">暂无已发布公告</div>}
      </div>
    </div>
  );
}
