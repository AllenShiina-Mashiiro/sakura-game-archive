import { readDb } from '@/lib/db';
import { ActionForm } from '@/app/components/ActionForm';
import { ImageUploadField } from '@/app/components/ImageUploadField';
import { MultiImageUploadField } from '@/app/components/MultiImageUploadField';
export const dynamic = 'force-dynamic';
export default async function SubmitTutorial() {
  const db = await readDb();
  return (
    <div className="page-wrap">
      <div className="eyebrow">CONTRIBUTE</div>
      <h1>投稿教程</h1>
      <p className="subtitle">投稿与教程浏览分开管理。提交后进入审核，通过后公开。</p>
      <section className="admin-section">
        <ActionForm action="guide" button="提交审核">
          <label>
            教程标题
            <input name="title" required minLength={3} />
          </label>
          <label>
            关联游戏
            <select name="gameId">
              <option value="">综合教程</option>
              {db.games.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            分类
            <input name="category" defaultValue="教程" />
          </label>
          <ImageUploadField name="cover" label="教程封面" folder="tutorials" />
          <MultiImageUploadField name="bodyImages" label="教程正文图片" folder="tutorials" />
          <label>
            正文
            <textarea name="content" rows={12} required minLength={20} placeholder="可使用分段组织教程内容，建议包含环境、步骤和注意事项" />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
