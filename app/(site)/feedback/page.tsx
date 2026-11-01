import { readDb } from '@/lib/db';
import { ActionForm } from '../../components/ActionForm';
import { getSessionUser } from '@/lib/auth';
import { MultiImageUploadField } from '@/app/components/MultiImageUploadField';
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
      <nav className="detail-section-nav feedback-tabs"><a href="#submit-feedback">提交反馈</a><a href="#my-feedback">我的反馈（{mine.length}）</a></nav>
      <section id="submit-feedback" className="detail-section">
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
          <MultiImageUploadField name="images" label="问题截图（支持多图）" folder="feedback" />
        </ActionForm>
      </section>
      <section id="my-feedback" className="detail-section">
        <h2>我的反馈记录</h2>
        <div className="content-grid">
          {mine.map((f) => (
            <article className="content-card" key={f.id}>
              <span className="tag">{f.status === 'pending' ? '待处理' : f.status === 'processing' ? '处理中' : f.status === 'fixed' ? '已修复' : f.status === 'failed' ? '修复失败' : f.status === 'accepted' ? '已采纳' : '已拒绝'}</span>
              <h3>{f.title}</h3>
              <small><a href={`/users/${encodeURIComponent(f.userId)}`}>{f.username}</a> · {f.createdAt.slice(0, 10)} · {f.type}</small>
              <details className="feedback-detail">
                <summary>查看反馈详情与处理进度</summary>
                <p className="multiline">{f.description}</p>
                <p><b>当前状态：</b>{f.status === 'pending' ? '等待管理员处理' : f.status === 'processing' ? '处理中' : f.status === 'fixed' ? '已修复' : f.status === 'failed' ? '修复失败' : f.status === 'accepted' ? '已采纳' : '未采纳'}</p>
                <p><b>管理员回复：</b>{f.reply || '管理员暂未回复'}</p>
                <div className="feedback-progress-timeline">{(f.statusHistory || []).map((step, index) => <div className="feedback-progress-step" key={`${step.at}-${index}`}><b>{step.status === 'processing' ? '处理中' : step.status === 'fixed' ? '已修复' : step.status === 'failed' ? '修复失败' : step.status === 'accepted' ? '已采纳' : step.status}</b><small>{new Date(step.at).toLocaleString('zh-CN')} · {step.by}</small>{step.reply && <p>{step.reply}</p>}</div>)}</div>
                {f.rewardGranted && <p className="muted">EXP 奖励已发放</p>}
              </details>
              {f.status === 'pending' && (
                <ActionForm action="feedback-update" button="保存修改" successMessage="反馈已更新">
                  <input type="hidden" name="id" value={f.id} />
                  <label>修改标题<input name="title" required minLength={3} defaultValue={f.title} /></label>
                  <label>修改类型<select name="type" defaultValue={f.type}><option>游戏 Bug</option><option>游戏运行问题</option><option>游戏内容问题</option><option>网站 Bug</option><option>功能建议</option><option>其他</option></select></label>
                  <label>修改描述<textarea name="description" rows={4} required minLength={5} defaultValue={f.description} /></label>
                  <MultiImageUploadField name="images" label="修改问题截图" folder="feedback" initial={f.images || (f.image ? [f.image] : [])} />
                  <input type="hidden" name="gameId" value={f.gameId} />
                </ActionForm>
              )}
              <ActionForm action="feedback-delete" button="删除这条反馈" successMessage="反馈已删除">
                <input type="hidden" name="id" value={f.id} />
              </ActionForm>
            </article>
          ))}
          {!mine.length && <div className="empty-state">你还没有提交过反馈。</div>}
        </div>
      </section>
    </div>
  );
}
