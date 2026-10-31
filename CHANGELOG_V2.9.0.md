# Sakura Game Archive 2.9.0

## 本次改进
- 管理后台用户列表支持调整用户 EXP、授予/撤销自定义徽章；新增徽章会发送站内通知。
- 登录时优先读取 Netlify 的 `x-nf-client-connection-ip`，并在管理后台展示最近登录日志。
- 贡献者支持头像、EXP、等级和自定义徽章展示。
- 重新开放樱花商店；经验兑换比例为 10 EXP = 1 樱花币，不扣除经验。
- 通过 `expConverted` 累计记录已兑换经验，只允许兑换新增经验，避免重复兑换。
- 默认提供三款头像框商品；已有自定义商品仍会保留。
- 移除阻塞首屏的 Google Fonts CSS @import，改用系统字体栈；增加长列表内容可见性优化。
- 补充浅色模式的表单、卡片、弹层和文字对比度样式。

## 重要说明
- 数据仍保存在 Supabase `app_state` JSON 记录中。本版本不擅自迁移数据库结构。
- IP 记录依赖 Netlify 转发的客户端 IP 请求头；本地、代理或隐私网络下可能显示 unknown 或代理出口 IP。
- 本次代码修改尚未在真实 Netlify/Supabase 项目上部署验证。请先在 Netlify Deploy Preview 测试，再合并到生产分支。
