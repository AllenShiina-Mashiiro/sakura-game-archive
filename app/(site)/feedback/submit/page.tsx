import Link from 'next/link';
import { readDb } from '@/lib/db';
import { ActionForm } from '@/app/components/ActionForm';
import { MultiImageUploadField } from '@/app/components/MultiImageUploadField';
export const dynamic = 'force-dynamic';
export default async function SubmitFeedback() {
  const db = await readDb();
  return <div className="page-wrap">
    <header className="topbar"><div><div className="eyebrow">PLAYER SUPPORT / NEW REPORT</div><h1>提交反馈</h1><p className="subtitle">请尽量描述复现步骤、预期结果与实际情况。Bug 可上传多张截图。</p></div><Link className="outline-btn" href="/feedback">返回反馈中心</Link></header>
    <section className="detail-section">
      <ActionForm action="feedback" button="提交反馈">
        <label>标题<input name="title" required minLength={3} maxLength={120} /></label>
        <label>反馈类型<select name="type"><option>游戏 Bug</option><option>游戏运行问题</option><option>游戏内容问题</option><option>网站 Bug</option><option>功能建议</option><option>其他</option></select></label>
        <label>关联游戏<select name="gameId"><option value="">不关联游戏</option>{db.games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        <label>详细描述<textarea name="description" rows={7} required minLength={5} maxLength={5000} placeholder="请描述问题发生的环境、操作步骤和实际表现。" /></label>
        <MultiImageUploadField name="images" label="问题截图（支持多图）" folder="feedback" />
      </ActionForm>
    </section>
  </div>;
}
