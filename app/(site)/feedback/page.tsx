import Link from 'next/link';
import { readDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function Feedback() {
  const [db, user] = await Promise.all([readDb(), getSessionUser()]);
  const mine = db.feedback.filter((f) => f.userId === user?.id);
  return <div className="page-wrap">
    <header className="topbar"><div><div className="eyebrow">PLAYER SUPPORT</div><h1>问题反馈</h1><p className="subtitle">反馈游戏问题、网站 Bug 或功能建议；可分别进入提交页面与个人反馈记录。</p></div></header>
    <div className="content-grid feedback-entry-grid">
      <Link className="content-card feedback-entry-card" href="/feedback/submit"><span className="eyebrow">NEW REPORT</span><h2>提交反馈</h2><p>描述遇到的问题或提出功能建议，支持上传多张截图。</p><span className="outline-btn">前往提交 →</span></Link>
      <Link className="content-card feedback-entry-card" href="/feedback/mine"><span className="eyebrow">MY REPORTS</span><h2>我的反馈（{mine.length}）</h2><p>查看每条反馈的处理状态、管理员回复、进度时间线，并修改仍可编辑的反馈。</p><span className="outline-btn">查看记录 →</span></Link>
    </div>
  </div>;
}
