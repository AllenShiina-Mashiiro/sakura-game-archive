import { readDb } from '@/lib/db';
import { ActionForm } from '../../components/ActionForm';
import { getSessionUser } from '@/lib/auth';
import { ImageUploadField } from '@/app/components/ImageUploadField';
export const dynamic = 'force-dynamic';
export default async function Feedback() {
  const [db, user] = await Promise.all([readDb(), getSessionUser()]);
  const mine = db.feedback.filter((f) => f.userId === user?.id);
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">PLAYER SUPPORT</div>
          <h1>问题反馈</h1>
          <p className="subtitle">反馈游戏问题、网站 Bug 或功能建议。审核采纳后可获得经验。</p>
        </div>
      </header>
      <section className="detail-section">
        <h2>提交反馈</h2>
        <ActionForm action="feedback" button="提交反馈">
          <label>
            标题
            <input name="title" required minLength={3} />
          </label>
          <label>
            反馈类型
            <select name="type">
              <option>游戏 Bug</option>
              <option>游戏运行问题</option>
              <option>游戏内容问题</option>
              <option>网站 Bug</option>
              <option>功能建议</option>
              <option>其他</option>
            </select>
          </label>
          <label>
            关联游戏
            <select name="gameId">
              <option value="">不关联游戏</option>
              {db.games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            详细描述
            <textarea name="description" rows={6} required minLength={5} />
          </label>
          <ImageUploadField name="image" label="上传问题截图（可选）" folder="feedback" />
        </ActionForm>
      </section>
      <section className="detail-section">
        <h2>我的反馈记录</h2>
        <div className="content-grid">
          {mine.map((f) => (
            <article className="content-card" key={f.id}>
              <span className="tag">{f.status === 'pending' ? '待处理' : f.status === 'accepted' ? '已采纳' : '已拒绝'}</span>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
              {f.reply && (
                <p>
                  <b>管理员回复：</b>
                  {f.reply}
                </p>
              )}
              <small>{f.createdAt.slice(0, 10)}</small>
            </article>
          ))}
          {!mine.length && <div className="empty-state">你还没有提交过反馈。</div>}
        </div>
      </section>
    </div>
  );
}
