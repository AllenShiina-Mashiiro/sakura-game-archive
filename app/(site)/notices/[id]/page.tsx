import { notFound } from 'next/navigation';
import Link from 'next/link';
import { readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function NoticeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = (await readDb()).notices.find((x) => x.id === id && x.published);
  if (!n) notFound();
  return (
    <div className="page-wrap article-page">
      <Link className="back-link" href="/notices">← 返回公告牌</Link>
      {n.cover && <img className="article-cover" src={n.cover} alt="" />}
      <div className="eyebrow">NOTICE / {n.date}</div>
      <h1>{n.title}</h1>
      {n.subtitle && <h2 className="article-subtitle">{n.subtitle}</h2>}
      <p className="subtitle">
        发布于 {n.date} · 最后修改 {n.updatedAt ? new Date(n.updatedAt).toLocaleString('zh-CN') : n.date} · 更新者 {n.updatedById ? <Link href={`/users/${encodeURIComponent(n.updatedById)}`}>{n.updatedBy}</Link> : n.updatedBy}
      </p>
      <div className="article-body">{n.content.split(/\n{2,}/).map((part, i) => <p key={i}>{part}</p>)}</div>
    </div>
  );
}
