import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { readDb } from '@/lib/db';
import { ActionForm } from '@/app/components/ActionForm';
import { AdminReview } from '@/app/components/AdminReview';
import { ImageUploadField } from '@/app/components/ImageUploadField';
import { UserManagement } from '@/app/components/UserManagement';
import { PhotoAdminCard } from '@/app/components/PhotoAdminCard';
import { NoticeEditForm } from '@/app/components/NoticeEditForm';
import { ImageViewer } from '@/app/components/ImageViewer';
import { AdminDeleteButton } from '@/app/components/AdminDeleteButton';
import { GuideEditForm } from '@/app/components/GuideEditForm';
import { GameEditForm } from '@/app/components/GameEditForm';
import { ResourceEditForm } from '@/app/components/ResourceEditForm';
import { ContributorEditForm } from '@/app/components/ContributorEditForm';
import { AdminSearchList } from '@/app/components/AdminSearchList';
export const dynamic = 'force-dynamic';
export default async function Admin({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const params = await searchParams;
  const section = params.section || '';
  const user = await getSessionUser();
  if (user?.role !== 'admin') redirect('/');
  const db = await readDb();
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>管理后台</h1>
          <p className="subtitle">采用分区导航管理内容，不再把所有表单堆在同一屏。</p>
        </div>
      </header>
      {!section && <section className="admin-overview">
        <Stat label="用户" value={db.users.length} />
        <Stat label="待审核教程" value={db.guides.filter((g) => g.status === 'pending').length} />
        <Stat label="待处理反馈" value={db.feedback.filter((f) => f.status === 'pending').length} />
        <Stat label="游戏档案" value={db.games.length} />
      </section>}
      {section ? (
        <div className="admin-page-heading">
          <a className="back-link" href="/admin">← 返回管理后台</a>
          <h2>{({ users: '账户管理', reviews: '内容审核', tutorials: '教程管理', games: '游戏档案', resources: '拓展资源', notices: '公告牌', photos: '照片墙', appearance: '站点外观', contributors: '贡献者中心' } as Record<string, string>)[section] || '管理分区'}</h2>
        </div>
      ) : (
        <nav className="admin-module-grid">
          {[
            ['users', '账户', '用户资料、经验、徽章与登录记录', '♙'],
            ['reviews', '内容审核', '处理教程投稿与问题反馈', '✓'],
            ['tutorials', '教程管理', '编辑、维护和删除教程内容', '▤'],
            ['games', '游戏档案', '维护游戏资料与版本记录', '◈'],
            ['resources', '拓展资源', '发布补丁、工具和扩展内容', '⌘'],
            ['notices', '公告牌', '发布和维护社区公告', '▣'],
            ['photos', '照片墙', '管理壁纸与社区图片', '▧'],
            ['appearance', '站点外观', '配置全站背景、主题与品牌', '✧'],
            ['contributors', '贡献者中心', '维护开发者资料与专属背景', '✿'],
          ].map(([key, title, description, icon]) => (
            <a className="admin-module-card" href={`/admin/${key}`} key={key}>
              <span>{icon}</span>
              <div><b>{title}</b><small>{description}</small></div>
              <i>→</i>
            </a>
          ))}
        </nav>
      )}
      {section === "users" && (
      <section id="users" className="admin-section">
        <h2>账户管理</h2>
        <UserManagement
          users={db.users.map((u) => ({
            id: u.id,
            username: u.username,
            nickname: u.nickname,
            role: u.role,
            status: u.status,
            createdAt: u.createdAt,
            exp: u.exp,
            badges: u.badges || [],
            title: u.title || '',
            lastLoginAt: u.lastLoginAt,
            lastLoginIp: u.lastLoginIp,
          }))}
        />
        <details className="admin-form-panel">
          <summary>最近登录记录（最多保留 5000 条）</summary>
          <div className="table-card login-log-table">
            {(db.loginLogs || []).slice(0, 200).map((log) => (
              <div className="admin-row" key={log.id}>
                <div><b>{log.username}</b><small>{log.date}</small></div>
                <code>{log.ip || 'unknown'}</code>
              </div>
            ))}
            {!(db.loginLogs || []).length && <p className="muted">暂无登录记录。</p>}
          </div>
        </details>
      </section>
      )}
      {section === "reviews" && (
      <section id="reviews" className="admin-section">
        <h2>内容审核</h2>
        <h3>教程投稿</h3>
        {db.guides
          .filter((g) => g.status === 'pending')
          .map((g) => (
            <article className="review-card" key={g.id}>
              <b>{g.title}</b>
              <small>
                {g.author} · {g.date}
              </small>
              <p>{g.content}</p>
              <Review id={g.id} action="review-guide" />
              <AdminDeleteButton action="guide-delete" id={g.id} label="删除教程" />
            </article>
          ))}
        {!db.guides.some((g) => g.status === 'pending') && <p className="muted">暂无待审核教程。</p>}
        <h3>问题反馈</h3>
        {db.feedback
          .filter((f) => f.status === 'pending')
          .map((f) => (
            <article className="review-card" key={f.id}>
              <b>
                {f.title} · {f.type}
              </b>
              <small>
                {f.username} · {f.createdAt}
              </small>
              <p>{f.description}</p>
              {f.image && <ImageViewer src={f.image} alt="反馈附件" className="review-image" />}
              <Review id={f.id} action="review-feedback" />
            </article>
          ))}
        {!db.feedback.some((f) => f.status === 'pending') && <p className="muted">暂无待处理反馈。</p>}
      </section>
      )}
      {section === "tutorials" && (
      <section id="guide-management" className="admin-section">
        <h2>教程管理</h2>
        <p className="muted">管理员可以创建、关联游戏、修改和删除教程；发布后会在所关联游戏档案的攻略与开发者说明中显示。</p>
        <details open className="admin-form-panel">
          <summary>创建教程 / 开发者说明</summary>
          <ActionForm action="guide-admin-create" button="发布教程" successMessage="教程已发布，并已关联所选游戏。">
            <label>教程标题<input name="title" minLength={3} required /></label>
            <label>关联游戏<select name="gameId" defaultValue=""><option value="">综合教程（不关联单个游戏）</option>{db.games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
            <label>分类<input name="category" defaultValue="攻略" placeholder="攻略 / 开发者说明 / 安装教程" /></label>
            <label>封面图片 URL<input name="cover" type="url" /></label>
            <label>正文<textarea name="content" rows={9} minLength={20} required /></label>
          </ActionForm>
        </details>
        <AdminSearchList items={db.guides.map((g) => ({ id: g.id, search: [g.title,g.author,g.category,g.gameName,g.status,g.content].join(' '), content: <div className="admin-row"><div><b>{g.title}</b><small>{g.author || '未知作者'} · {g.status || '未设置状态'} · 发布于 {g.date} · 最后修改 {g.updatedAt ? new Date(g.updatedAt).toLocaleString('zh-CN') : '尚未修改'}</small></div><GuideEditForm guide={g} games={db.games.map((x) => ({ id: x.id, name: x.name }))} /><AdminDeleteButton action="guide-delete" id={g.id} label="删除教程" /></div> }))} placeholder="搜索教程标题、作者、分类或正文…" />
      </section>
      )}
      {section === "games" && (
      <section id="games" className="admin-section">
        <h2>游戏档案</h2>
        <details open className="admin-form-panel">
          <summary>新增游戏档案</summary>
          <ActionForm action="game-save" button="保存游戏档案">
            <label>
              游戏名称
              <input name="name" required />
            </label>
            <label>
              Slug
              <input name="slug" required pattern="[a-z0-9-]+" />
            </label>
            <ImageUploadField name="cover" label="游戏封面" folder="games" />
            <label>
              游戏类型
              <input name="genre" />
            </label>
            <label>
              平台（逗号分隔）
              <input name="platforms" placeholder="PC, Android, iOS" />
            </label>
            <label>
              当前版本
              <input name="latestVersion" />
            </label>
            <label>
              状态
              <select name="status">
                <option>运营中</option>
                <option>测试中</option>
                <option>已停更</option>
              </select>
            </label>
            <label>
              标签（逗号分隔）
              <input name="tags" />
            </label>
            <label>
              最低配置
              <textarea name="minimum" />
            </label>
            <label>
              推荐配置
              <textarea name="recommended" />
            </label>
            <label>
              简介
              <textarea name="description" rows={4} />
            </label>
          </ActionForm>
        </details>
        <details className="admin-form-panel">
          <summary>登记版本更新</summary>
          <ActionForm action="game-record" button="添加版本记录">
            <label>
              选择游戏
              <select name="gameId" required>
                {db.games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="kind" value="update" />
            <label>
              日期
              <input name="date" type="date" required />
            </label>
            <label>
              版本号
              <input name="version" required />
            </label>
            <label>
              更新标题
              <input name="title" required />
            </label>
            <label>
              更新内容
              <textarea name="notes" rows={4} />
            </label>
          </ActionForm>
        </details>
        <details className="admin-form-panel">
          <summary>登记资源文件</summary>
          <ActionForm action="game-record" button="添加资源记录">
            <label>
              选择游戏
              <select name="gameId" required>
                {db.games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="kind" value="file" />
            <label>
              资源名称
              <input name="name" required />
            </label>
            <label>
              版本
              <input name="version" />
            </label>
            <label>
              文件大小
              <input name="size" />
            </label>
            <label>
              校验值
              <input name="checksum" />
            </label>
            <label>
              记录日期
              <input name="date" type="date" required />
            </label>
            <label>
              下载地址
              <input name="url" type="url" />
            </label>
            <label>
              备注
              <textarea name="notes" rows={3} />
            </label>
          </ActionForm>
        </details>
        <AdminSearchList items={db.games.map((g) => ({ id: g.id, search: [g.name,g.slug,g.latestVersion,...(g.tags||[])].join(' '), content: <div className="admin-row"><div><b>{g.name} · {g.latestVersion}</b><small>{g.slug} · {(g.tags||[]).join(' / ')}</small></div><GameEditForm game={g} /><AdminDeleteButton action="game-delete" id={g.id} label="删除档案" /></div> }))} placeholder="搜索游戏名称、Slug、版本或标签…" />
      </section>
      )}
      {section === "resources" && (
      <section id="resources" className="admin-section">
        <h2>拓展资源</h2>
        <details open className="admin-form-panel">
          <summary>发布拓展资源</summary>
          <ActionForm action="resource-save" button="发布资源">
            <label>
              资源名称
              <input name="title" required />
            </label>
            <label>
              所属游戏
              <select name="gameId">
                <option value="">通用资源</option>
                {db.games.map((g) => (
                  <option value={g.id} key={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <ImageUploadField name="cover" label="资源封面" folder="resources" />
            <label>
              版本
              <input name="version" />
            </label>
            <label>
              适用范围
              <input name="scope" />
            </label>
            <label>
              安装方式
              <textarea name="install" />
            </label>
            <label>
              资源说明
              <textarea name="description" rows={4} />
            </label>
            <label>
              下载地址 / 外链
              <input name="url" type="url" />
            </label>
            <label>
              关联教程
              <input name="tutorial" />
            </label>
            <label>
              标签（逗号分隔）
              <input name="tags" />
            </label>
          </ActionForm>
        </details>
        <AdminSearchList items={db.resources.map((r) => ({ id: r.id, search: [r.title,r.gameName,r.description,r.version,...(r.tags||[])].join(' '), content: <div className="admin-row"><div><b>{r.title}</b><small>{r.gameName} · {(r.tags||[]).join(' / ')}</small></div><ResourceEditForm resource={r} games={db.games.map(g=>({id:g.id,name:g.name}))} /><AdminDeleteButton action="resource-delete" id={r.id} /></div> }))} placeholder="搜索资源名称、游戏、版本或标签…" />
      </section>
      )}
      {section === "notices" && (
      <section id="notices" className="admin-section">
        <h2>公告牌</h2>
        <details open className="admin-form-panel">
          <summary>发布公告</summary>
          <ActionForm action="notice-save" button="发布公告">
            <label>
              标题
              <input name="title" required />
            </label>
            <label>
              副标题
              <input name="subtitle" />
            </label>
            <ImageUploadField name="cover" label="公告大图" folder="notices" />
            <label>
              正文
              <textarea name="content" rows={8} required />
            </label>
            <label className="check-label">
              <input name="pinned" type="checkbox" value="true" /> 置顶
            </label>
            <label className="check-label">
              <input name="published" type="checkbox" value="true" defaultChecked /> 立即发布
            </label>
          </ActionForm>
        </details>
        <div className="table-card">
          {db.notices.map((n) => (
            <div className="admin-row" key={n.id}>
              <div>
                <b>{n.title}</b>
                <small>
                  发布于 {n.date} · 最后修改 {n.updatedAt ? new Date(n.updatedAt).toLocaleString('zh-CN') : n.date} · 修改者 {n.updatedBy} · 历史版本 {(n.history || []).length}
                </small>
              </div>
              <div className="inline-admin-form">
                <NoticeEditForm notice={n} />
                <AdminDeleteButton action="notice-delete" id={n.id} />
              </div>
            </div>
          ))}
        </div>
      </section>
      )}
      {section === "photos" && (
      <section id="photos" className="admin-section">
        <h2>照片墙</h2>
        <details open className="admin-form-panel">
          <summary>添加壁纸 / 图片</summary>
          <ActionForm action="photo-save" button="发布到照片墙">
            <label>
              图片标题
              <input name="title" required />
            </label>
            <label>
              图片说明
              <textarea name="description" rows={3} />
            </label>
            <ImageUploadField name="image" label="上传 4K 原图" folder="photos" maxSizeMB={50} />
            <label>
              标签（逗号分隔）
              <input name="tags" />
            </label>
          </ActionForm>
        </details>
        <div className="photo-admin-grid">
          {db.photos.map((photo) => (
            <PhotoAdminCard key={photo.id} id={photo.id} title={photo.title} image={photo.image} />
          ))}
        </div>
      </section>
      )}
      {section === "appearance" && (
      <section id="appearance" className="admin-section">
        <h2>站点外观</h2>
        <p className="muted">管理 Logo、首页背景、默认主题色和樱花粒子。用户可以在右下角单独覆盖主题。</p>
        <ActionForm action="site-branding" button="保存站点外观">
          <ImageUploadField name="logo" label="网站左上角 Logo（侧边栏与登录页）" folder="branding" initial={db.siteSettings?.logo || ''} />
          <ImageUploadField name="heroLogo" label="首页右侧 G+ 品牌标识" folder="branding" initial={db.siteSettings?.heroLogo || ''} />
          <ImageUploadField name="background" label="首页页面背景图片" folder="backgrounds" initial={db.siteSettings?.background || ''} />
          <ImageUploadField name="homeBackground" label="首页宣传模块背景图片" folder="backgrounds" initial={db.siteSettings?.homeBackground || ''} />
          <div className="appearance-sliders">
            <h3>透明度与背景显示</h3>
            <p className="muted">透明度仅作用于背景层或指定 UI 面板，不会降低文字本身的清晰度。</p>
            <label>
              背景图片显示强度（越高越清晰）
              <input type="range" name="backgroundOpacity" min="10" max="100" step="5" defaultValue={db.siteSettings?.backgroundOpacity ?? 72} />
            </label>
            <label>
              主内容面板不透明度
              <input type="range" name="panelOpacity" min="35" max="100" step="5" defaultValue={db.siteSettings?.panelOpacity ?? 88} />
            </label>
            <label>
              普通卡片不透明度
              <input type="range" name="cardOpacity" min="35" max="100" step="5" defaultValue={db.siteSettings?.cardOpacity ?? 90} />
            </label>
            <label>
              导航栏不透明度
              <input type="range" name="navOpacity" min="35" max="100" step="5" defaultValue={db.siteSettings?.navOpacity ?? 92} />
            </label>
            <label>
              弹窗与浮层不透明度
              <input type="range" name="popupOpacity" min="35" max="100" step="5" defaultValue={db.siteSettings?.popupOpacity ?? 94} />
            </label>
          </div>
          <label>
            默认主题色
            <input name="defaultThemeColor" type="color" defaultValue={db.siteSettings?.defaultThemeColor || '#ec8eb8'} />
          </label>
          <label>
            默认昼夜模式
            <select name="defaultThemeMode" defaultValue={db.siteSettings?.defaultThemeMode || 'dark'}>
              <option value="dark">夜间模式</option>
              <option value="light">昼间模式</option>
            </select>
          </label>
          <label className="check-label">
            <input type="hidden" name="sakuraEnabled" value="false" />
            <input name="sakuraEnabled" type="checkbox" value="true" defaultChecked={db.siteSettings?.sakuraEnabled !== false} /> 默认开启樱花粒子
          </label>
        </ActionForm>
      </section>
      )}
      {section === "contributors" && (
      <section id="contributors" className="admin-section">
        <h2>贡献者中心管理</h2>
        <p className="muted">维护开发者介绍、捐赠二维码和贡献者榜单。捐赠信息请保持自愿、透明。</p>
        <ActionForm action="contributor-settings" button="保存开发者资料">
          <label>
            开发者昵称
            <input name="nickname" defaultValue={db.siteSettings?.contributor?.nickname || '开发者'} />
          </label>
          <ImageUploadField name="developerAvatar" label="开发者头像" folder="contributors" initial={db.siteSettings?.contributor?.avatar || ''} />
          <label>
            开发者等级 / 头衔
            <input name="level" defaultValue={db.siteSettings?.contributor?.level || ''} />
          </label>
          <label>
            GitHub 链接
            <input name="github" defaultValue={db.siteSettings?.contributor?.github || ''} />
          </label>
          <label>
            Bilibili 链接
            <input name="bilibili" defaultValue={db.siteSettings?.contributor?.bilibili || ''} />
          </label>
          <label>
            QQ 联系方式
            <input name="qq" defaultValue={db.siteSettings?.contributor?.qq || ''} />
          </label>
          <label>
            联系邮箱
            <input name="email" type="email" defaultValue={db.siteSettings?.contributor?.email || ''} />
          </label>
          <label>
            开发者介绍
            <textarea name="intro" rows={3} defaultValue={db.siteSettings?.contributor?.intro || ''} />
          </label>
          <ImageUploadField name="donationQr" label="捐赠二维码图片" folder="contributors" initial={db.siteSettings?.contributor?.donationQr || ''} />
          <ImageUploadField name="contributorBackground" label="贡献者中心专属背景" folder="backgrounds" initial={db.siteSettings?.contributorBackground || ''} />
          <label>
            项目贡献（每行一项）
            <textarea name="contributions" rows={6} defaultValue={(db.siteSettings?.contributor?.contributions || []).join('\n')} />
          </label>
        </ActionForm>
        <AdminDeleteButton action="contributor-settings-delete" id="profile" label="删除开发者资料" />
        <details className="admin-form-panel">
          <summary>添加贡献者 / 志愿者</summary>
          <ActionForm action="contributor-add" button="添加贡献者">
            <label>
              昵称
              <input name="name" required />
            </label>
            <label>
              身份 / 头衔
              <input name="role" placeholder="例如：前端志愿者" />
            </label>
            <label>
              贡献类型
              <select name="kind">
                <option value="volunteer">志愿者</option>
                <option value="technical">技术贡献</option>
                <option value="content">内容贡献</option>
                <option value="financial">资金支持</option>
              </select>
            </label>
            <label>
              贡献说明
              <textarea name="description" rows={3} required />
            </label>
            <ImageUploadField name="avatar" label="贡献者头像" folder="contributors" />
            <label>
              经验值
              <input name="exp" type="number" min="0" max="1000000" defaultValue="0" />
            </label>
            <label>
              徽章（逗号分隔）
              <input name="badges" placeholder="例如：技术支持, 内容贡献者" />
            </label>
            <label>
              关联用户 ID（可选）
              <input name="userId" />
            </label>
          </ActionForm>
        </details>
        <AdminSearchList items={(db.contributors || []).map((c) => ({ id: c.id, search: [c.name,c.role,c.kind,c.description,...(c.badges||[])].join(' '), content: <div className="admin-row"><div><b>{c.name} · {c.role}</b><small>{c.kind} · {c.description}</small><small>Lv.{levelForContributor(c.exp || 0)} · {c.exp || 0} EXP · {(c.badges || []).join(' / ') || '暂无徽章'}</small></div><ContributorEditForm item={c} /><ActionForm action="contributor-delete" button="移除" className="inline-action-form"><input type="hidden" name="id" value={c.id} /></ActionForm></div> }))} placeholder="搜索贡献者昵称、身份或贡献说明…" />
      </section>      )}

    </div>
  );
}
function levelForContributor(exp: number) {
  const thresholds = [0,50,120,220,350,500,680,880,1100,1350,1650,2000,2400,2850,3350,3900,4500,5150,5850,6600,7400,8250,9150,10100,11100,12200,13400,14700,16100,17600];
  let level = 1; thresholds.forEach((n, i) => { if (exp >= n) level = i + 1; }); return level;
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Review({ id, action }: { id: string; action: string }) {
  return <AdminReview id={id} action={action} />;
}
