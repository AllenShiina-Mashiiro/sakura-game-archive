import { getSessionUser } from '@/lib/auth';
import { readDb } from '@/lib/db';
import { ActionForm } from '../../components/ActionForm';
import { ProfileEditor } from '../../components/ProfileEditor';
import { redirect } from 'next/navigation';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
const thresholds = [0, 50, 120, 220, 350, 500, 680, 880, 1100, 1350, 1650, 2000, 2400, 2850, 3350, 3900, 4500, 5150, 5850, 6600, 7400, 8250, 9150, 10100, 11100, 12200, 13400, 14700, 16100, 17600];
export default async function Profile() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const db = await readDb();
  const level = calcLevel(user.exp);
  const current = thresholds[level - 1] ?? 0;
  const next = thresholds[level] ?? current + 2000;
  const progress = Math.max(0, Math.min(100, ((user.exp - current) / (next - current)) * 100));
  const owned = user.badges || [];
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">ACCOUNT CENTER</div>
          <h1>个人资料</h1>
          <p className="subtitle">账户信息、等级经验与个人贡献。</p>
        </div>
      </header>
      <section
        className="profile-hero"
        style={
          user.cardBackground
            ? {
                backgroundImage: `linear-gradient(90deg,rgba(12,15,24,.82),rgba(12,15,24,.38)),url("${user.cardBackground}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className={`avatar avatar-large avatar-frame-${user.avatarFrame || 'none'}`}>{user.avatar ? <img src={user.avatar} alt="" /> : user.nickname.slice(0, 1)}</div>
        <div>
          <h2>{user.nickname}</h2>
          <p>
            @{user.username} · {user.role.toUpperCase()}
          </p>
          <span className="tag">
            Lv.{level} · {user.title || '见习档案员'}
          </span>
          {user.selectedBadge && <span className="tag profile-equipped-badge">✿ {user.selectedBadge}</span>}
        </div>
        <div className="profile-exp">
          <b>{user.exp} EXP</b>
          <small>当前经验值</small>
        </div>
      </section>
      <section className="detail-section exp-progress-panel">
        <div className="section-head">
          <div>
            <h2>等级成长</h2>
            <p className="muted">
              距离 Lv.{level + 1} 还差 {Math.max(0, next - user.exp)} EXP
            </p>
          </div>
          <b>Lv.{level}</b>
        </div>
        <div className="exp-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <small className="muted">
          {user.exp} / {next} EXP · {progress.toFixed(1)}%
        </small>
      </section>
      <div className="stats-grid">
        <Stat label="注册时间" value={user.createdAt.slice(0, 10)} />
        <Stat label="徽章数量" value={String(owned.length)} />
        <Stat label="我的教程" value={String(db.guides.filter((g) => g.userId === user.id).length)} />
        <Stat label="我的反馈" value={String(db.feedback.filter((f) => f.userId === user.id).length)} />
      </div>
      <section className="detail-section wallet-profile-card">
        <div>
          <h2>樱花币钱包</h2>
          <p className="muted">
            当前余额：<b className="coin-profile-balance">✿ {user.sakuraCoins || 0}</b> · 可兑换经验：
            {Math.floor(Math.max(0, (user.exp || 0) - (user.expConverted || 0)) / 10) * 10} EXP
          </p>
          <small className="muted">兑换比例 10 EXP = 1 樱花币；兑换不扣除经验，也不影响等级；只允许兑换尚未兑换过的新增经验。</small>
        </div>
        <Link className="primary-btn" href="/shop">进入樱花商店 →</Link>
      </section>
      <section className="detail-section">
        <h2>修改资料</h2>
        <ProfileEditor nickname={user.nickname} avatar={user.avatar} selectedBadge={user.selectedBadge || ''} avatarFrame={user.avatarFrame || 'none'} cardBackground={user.cardBackground || ''} badges={owned} />
      </section>
      <section className="detail-section">
        <h2>每日签到</h2>
        <p className="muted">手动签到每日 +10 EXP；每日首次登录另有 +5 EXP，两项独立计算。</p>
        <ActionForm action="checkin" button="今日签到 +10 EXP" successMessage="签到成功，获得 10 EXP" />
      </section>
      <section className="detail-section">
        <h2>个人徽章</h2>
        <div className="tag-row">
          {owned.map((b) => (
            <span className={`tag profile-badge-chip ${user.selectedBadge === b ? 'badge-equipped' : ''}`} key={b}>
              {user.selectedBadge === b ? '✓ ' : ''}
              {b}
            </span>
          ))}
          {!owned.length && <span className="muted">暂未获得徽章</span>}
        </div>
      </section>
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
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <small>{label}</small>
      <strong className="stat-small">{value}</strong>
    </div>
  );
}
