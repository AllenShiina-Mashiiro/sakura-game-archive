import { readDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default async function ContributorsPage() {
  const [db, user] = await Promise.all([readDb(), getSessionUser()]);
  const isAdmin = user?.role === 'admin';
  const c = db.siteSettings?.contributor || {
    nickname: '开发者',
    level: '',
    github: '',
    bilibili: '',
    qq: '',
    email: '',
    intro: '感谢每一位支持樱花社区的人。',
    donationQr: '',
    contributions: [],
  };
  const contributors = db.contributors || [];
  const kindName = (k: string) => ({ volunteer: '志愿者', content: '内容贡献', financial: '资金支持', technical: '技术贡献' })[k] || '社区贡献';
  return (
    <div
      className="page-wrap contributor-page"
      style={
        db.siteSettings?.contributorBackground
          ? {
              backgroundImage: `linear-gradient(rgba(8, 10, 16, 0.42), rgba(8, 10, 16, 0.58)), url("${db.siteSettings.contributorBackground}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: 'fixed',
            }
          : undefined
      }
    >
      <header className="topbar">
        <div>
          <div className="eyebrow">OPEN SOURCE & COMMUNITY</div>
          <h1>开发者与贡献者</h1>
          <p className="subtitle">每一份热爱与支持，都让这个社区继续生长。</p>
        </div>
      </header>
      <section className="developer-feature">
        <div className="developer-glow" />
        <div className="developer-kicker">PROJECT DEVELOPER</div>
        <div className="developer-avatar">{c.avatar ? <img src={c.avatar} alt="开发者头像" /> : '✿'}</div>
        <h2>{c.nickname}</h2>
        {c.level && <span className="tag">{c.level}</span>}
        <p>{c.intro}</p>
        <div className="developer-links">
          {c.github && (
            <a href={safeUrl(c.github)} target="_blank" rel="noreferrer">
              GitHub ↗
            </a>
          )}
          {c.bilibili && (
            <a href={safeUrl(c.bilibili)} target="_blank" rel="noreferrer">
              Bilibili ↗
            </a>
          )}
          {c.qq && <span>QQ：{c.qq}</span>}
          {c.email && <a href={`mailto:${c.email}`}>邮箱：{c.email}</a>}
        </div>
        <div className="developer-contributions">
          <h3>开发者贡献</h3>
          <ul>
            {(c.contributions || []).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          {!(c.contributions || []).length && <p>贡献记录正在整理中。</p>}
        </div>
        {c.donationQr && (
          <div className="donation-block">
            <h3>支持项目继续开发</h3>
            <p>如果你认可这个项目，欢迎自愿支持。</p>
            <img src={c.donationQr} alt="开发者捐赠二维码" />
          </div>
        )}
      </section>
      {isAdmin && <div className="detail-actions"><Link className="outline-btn" href="/admin?section=contributors">管理开发者资料与贡献者名单 ↗</Link></div>}
      <section className="contributors-section">
        <div className="section-head">
          <div>
            <h2>社区贡献榜</h2>
            <p>感谢志愿者、内容创作者与技术支持者。</p>
          </div>
          <span className="tag">{contributors.length} 位贡献者</span>
        </div>
        <div className="contributor-grid">
          {contributors.map((x) => (
            <article className="contributor-card" key={x.id}>
              {x.userId ? <Link className="contributor-avatar contributor-avatar-large" href={`/users/${encodeURIComponent(x.userId)}`} title={`查看${x.name}的主页`}>{x.avatar ? <img src={x.avatar} alt={`${x.name}头像`} loading="lazy" /> : '✿'}</Link> : <span className="contributor-avatar contributor-avatar-large">{x.avatar ? <img src={x.avatar} alt={`${x.name}头像`} loading="lazy" /> : '✿'}</span>}
              <div>
                {x.userId ? <b><Link href={`/users/${encodeURIComponent(x.userId)}`}>{x.name}</Link></b> : <b>{x.name}</b>
                <small>{kindName(x.kind)} · {x.role}</small>
                <div className="contributor-meta"><span className="tag">Lv.{levelForContributor(x.exp || 0)}</span><span className="muted">{x.exp || 0} EXP</span></div>
                <div className="contributor-badges">{(x.badges || []).map((badge) => <span className="contributor-badge" key={badge}>{badge}</span>)}</div>
                <p>{x.description}</p>
                {x.userId && <Link href={`/users/${x.userId}`}>查看主页 →</Link>}
              </div>
            </article>
          ))}
          {!contributors.length && <div className="empty-state">贡献者名单正在整理中，感谢所有默默支持项目的人。</div>}
        </div>
      </section>
      <p className="muted">感谢所有提出建议、提交内容、测试问题和参与维护的朋友。</p>
    </div>
  );
}
function safeUrl(v: string) {
  return /^https:\/\//i.test(v) ? v : `https://${v}`;
}

function levelForContributor(exp: number) {
  const thresholds = [0,50,120,220,350,500,680,880,1100,1350,1650,2000,2400,2850,3350,3900,4500,5150,5850,6600,7400,8250,9150,10100,11100,12200,13400,14700,16100,17600];
  let level = 1; thresholds.forEach((n, i) => { if (exp >= n) level = i + 1; }); return level;
}
