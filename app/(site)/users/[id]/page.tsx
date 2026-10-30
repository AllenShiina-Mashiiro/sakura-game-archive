import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
const thresholds = [0, 50, 120, 220, 350, 500, 680, 880, 1100, 1350, 1650, 2000, 2400, 2850, 3350, 3900, 4500, 5150, 5850, 6600, 7400, 8250, 9150, 10100, 11100, 12200, 13400, 14700, 16100, 17600];
export default async function PublicUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [db, viewer] = await Promise.all([readDb(), getSessionUser()]);
  const found = db.users.find((x) => x.id === id && x.status === 'active');
  if (!found) notFound();
  const u = found!;
  const level = calcLevel(u.exp);
  const start = thresholds[level - 1] || 0;
  const next = thresholds[level] || start + 2000;
  const progress = Math.max(0, Math.min(100, ((u.exp - start) / (next - start)) * 100));
  const guides = db.guides.filter((g) => g.userId === u.id && g.status === 'approved');
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">COMMUNITY MEMBER</div>
          <h1>用户主页</h1>
          <p className="subtitle">社区成员资料与公开贡献。</p>
        </div>
        <Link className="outline-btn" href="/messages">
          返回私信
        </Link>
      </header>
      <section className="public-profile-hero">
        <span className={`avatar avatar-large avatar-frame-${u.avatarFrame || 'none'}`}>{u.avatar ? <img src={u.avatar} alt="" /> : u.nickname.slice(0, 1)}</span>
        <div className="public-profile-info">
          <h2>{u.nickname}</h2>
          <p>
            @{u.username} · {u.role === 'admin' ? '管理员' : u.role === 'vip' ? 'VIP会员' : '社区成员'}
          </p>
          <div className="tag-row">
            <span className="tag">Lv.{level}</span>
            {u.selectedBadge && <span className="tag">✿ {u.selectedBadge}</span>}
            <span className="tag">{u.title || '社区成员'}</span>
          </div>
        </div>
        {viewer && viewer.id !== u.id && (
          <Link className="primary-btn" href={`/messages?with=${u.id}`}>
            发送私信
          </Link>
        )}
      </section>
      {u.cardBackground && (
        <div
          className="public-card-background"
          style={{
            backgroundImage: `linear-gradient(90deg,#11182766,#11182722),url("${u.cardBackground}")`,
          }}
        />
      )}
      <section className="detail-section exp-progress-panel">
        <div className="section-head">
          <div>
            <h2>等级成长</h2>
            <p className="muted">当前经验 {u.exp} EXP</p>
          </div>
          <b>Lv.{level}</b>
        </div>
        <div className="exp-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <small className="muted">距离下一级还差 {Math.max(0, next - u.exp)} EXP</small>
      </section>
      <section className="detail-section">
        <h2>佩戴徽章</h2>
        <div className="tag-row">
          {(u.badges || []).map((b) => (
            <span className={`tag ${u.selectedBadge === b ? 'badge-equipped' : ''}`} key={b}>
              {u.selectedBadge === b ? '✓ ' : ''}
              {b}
            </span>
          ))}
          {!(u.badges || []).length && <span className="muted">暂无徽章</span>}
        </div>
      </section>
      <section className="detail-section">
        <h2>公开教程 · {guides.length}</h2>
        <div className="content-grid">
          {guides.map((g) => (
            <Link className="content-card" href={`/tutorials/${g.id}`} key={g.id}>
              <h3>{g.title}</h3>
              <small>{g.date}</small>
              <p>{g.content.slice(0, 130)}</p>
            </Link>
          ))}
          {!guides.length && <div className="empty-state">暂未发布公开教程。</div>}
        </div>
      </section>
      <small className="muted">加入时间：{u.createdAt.slice(0, 10)}</small>
    </div>
  );
}
function calcLevel(exp: number) {
  let lv = 1;
  thresholds.forEach((n, i) => {
    if (exp >= n) lv = i + 1;
  });
  return lv;
}
