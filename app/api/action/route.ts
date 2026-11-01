import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { readDb, writeDb, mutateDb, createDefaultShopProducts } from '@/lib/db';
import { deleteUnreferencedStorageImages } from '@/lib/storage-cleanup';
import { getSessionUser, requireAdmin, hashPassword } from '@/lib/auth';
import type {
  Collection,
  Feedback,
  Guide,
  Resource,
  Game,
  Database,
  ShopProduct,
} from '@/lib/types';
const err = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : '操作失败' }, { status: e instanceof Error && e.message === 'FORBIDDEN' ? 403 : 500 });
function pushNotification(db: Database, userId: string, type: 'message' | 'comment' | 'feedback' | 'badge' | 'level' | 'system', title: string, body: string, href: string, actorId?: string) {
  if (!userId) return;
  db.notifications = db.notifications || [];
  db.notifications.unshift({
    id: randomUUID(),
    userId,
    type,
    title,
    body,
    href,
    createdAt: new Date().toISOString(),
    actorId,
  });
}
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    const ct = req.headers.get('content-type') || '';
    const raw = ct.includes('application/json') ? await req.json() : Object.fromEntries((await req.formData()).entries());
    const b: Record<string, unknown> = { ...raw };
    if (typeof b.exp === 'string' && b.exp.trim()) b.exp = Number(b.exp);
    if (typeof b.pinned === 'string') b.pinned = b.pinned === 'true';
    if (typeof b.published === 'string') b.published = b.published === 'true';
    if (typeof b.platforms === 'string')
      b.platforms = b.platforms
        .split(',')
        .map((x: string) => x.trim())
        .filter(Boolean);
    if (typeof b.tags === 'string')
      b.tags = b.tags
        .split(',')
        .map((x: string) => x.trim())
        .filter(Boolean);
    if (typeof b.minimum === 'string' || typeof b.recommended === 'string') b.config = { minimum: b.minimum || '', recommended: b.recommended || '' };
    const db = await readDb();
    const now = new Date().toISOString();

    // 管理员专用：将现有三个头像框商品价格同步为最新定价，不影响库存、图片或用户数据。
    if (b.action === 'admin-update-frame-prices') {
      await requireAdmin();
      const prices: Record<string, number> = {
        'frame-sakura': 50,
        'frame-gold': 100,
        'frame-glass': 150,
      };
      const result = await mutateDb((fresh) => {
        const updated: Array<{ id: string; name: string; price: number }> = [];
        for (const product of fresh.shopProducts || []) {
          const price = prices[product.id];
          if (price !== undefined) {
            product.price = price;
            product.updatedAt = new Date().toISOString();
            updated.push({ id: product.id, name: product.name, price: product.price });
          }
        }
        return updated;
      });
      return NextResponse.json({
        ok: true,
        message: '三个头像框商品价格已更新',
        products: result,
        updatedCount: result.length,
      });
    }

    // 旧重置动作已停用，避免误删普通用户账号。
    if (b.action === 'admin-reset-database') {
      await requireAdmin();
      return NextResponse.json({
        ok: false,
        error: '旧版重置动作已停用。请在 Storage 图片清理成功后，使用 admin-reset-database-preserve-users。',
      }, { status: 410 });
    }

    // 管理员专用：清空业务数据，但完整保留全部用户对象及站点外观设置。
    if (b.action === 'admin-reset-database-preserve-users') {
      await requireAdmin();

      const result = await mutateDb((fresh) => {
        const preservedUsers = fresh.users || [];
        const preservedAdmins = preservedUsers.filter((u) => u.role === 'admin').length;
        if (preservedAdmins < 1) {
          throw new Error('没有找到管理员账号，已停止重置。');
        }
        const preservedSiteSettings = fresh.siteSettings || {};
        const removedCounts = {
          games: (fresh.games || []).length,
          nestedGameGuides: (fresh.games || []).reduce((sum, game) => sum + (game.guides || []).length, 0),
          guides: (fresh.guides || []).length,
          resources: (fresh.resources || []).length,
          feedback: (fresh.feedback || []).length,
          notices: (fresh.notices || []).length,
          collections: (fresh.collections || []).length,
          comments: (fresh.comments || []).length,
          photos: (fresh.photos || []).length,
          loginLogs: (fresh.loginLogs || []).length,
          messages: (fresh.messages || []).length,
          notifications: (fresh.notifications || []).length,
          contributors: (fresh.contributors || []).length,
          shopProducts: (fresh.shopProducts || []).length,
          inventory: (fresh.inventory || []).length,
          coinTransactions: (fresh.coinTransactions || []).length,
        };

        // 不筛选、不重建 users：账号资料、角色、密码 hash、经验、樱花币及资产字段全部原样保留。
        fresh.users = preservedUsers;
        fresh.games = [];
        fresh.resources = [];
        fresh.guides = [];
        fresh.feedback = [];
        fresh.notices = [];
        fresh.collections = [];
        fresh.loginLogs = [];
        fresh.comments = [];
        fresh.photos = [];
        fresh.siteSettings = preservedSiteSettings;
        fresh.messages = [];
        fresh.notifications = [];
        fresh.contributors = [];
        fresh.shopProducts = createDefaultShopProducts();
        fresh.inventory = [];
        fresh.coinTransactions = [];

        return {
          preservedUsers: preservedUsers.length,
          preservedAdmins,
          preservedSiteSettings: Object.keys(preservedSiteSettings).length > 0,
          removedCounts,
          retainedShopProducts: fresh.shopProducts.map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price,
            effectValue: product.effectValue,
          })),
        };
      });

      return NextResponse.json({
        ok: true,
        message: '数据库业务数据已重置；所有用户账号及其字段、网站外观设置和三个默认头像框商品已保留。',
        details: result,
      });
    }
    if (b.action === 'checkin') {
      const result = await mutateDb((fresh) => {
        const u = fresh.users.find((x) => x.id === user.id);
        if (!u) return { error: '用户不存在' as const };
        if (u.lastCheckIn === now.slice(0, 10)) return { error: '今天已经签到过了' as const };
        const oldLevel = levelOf(u.exp);
        u.exp += 10;
        u.lastCheckIn = now.slice(0, 10);
        if (levelOf(u.exp) > oldLevel) pushNotification(fresh, u.id, 'level', '等级提升啦！', `恭喜升级至 Lv.${levelOf(u.exp)}。`, `/users/${u.id}`);
        return { exp: u.exp };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.error === '用户不存在' ? 404 : 409 });
      return NextResponse.json({ ok: true, exp: result.exp });
    }
    if (b.action === 'user-appearance') {
      const result = await mutateDb((fresh) => {
        const u = fresh.users.find((x) => x.id === user.id);
        if (!u) return false;
        if (b.themeMode === 'light' || b.themeMode === 'dark') {
  u.themeMode = b.themeMode;
}
        if (typeof b.themeColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.themeColor)) u.themeColor = b.themeColor;
        if (typeof b.sakuraEnabled === 'boolean') u.sakuraEnabled = b.sakuraEnabled;
        return true;
      });
      if (!result) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      return NextResponse.json({ ok: true, message: '个人外观设置已保存' });
    }
    if (b.action === 'profile') {
      if (typeof b.nickname !== 'string' || b.nickname.trim().length < 1 || b.nickname.trim().length > 24) return NextResponse.json({ error: '昵称需为 1-24 个字符' }, { status: 400 });
      const previousProfileImages = await mutateDb((fresh) => {
        const u = fresh.users.find((x) => x.id === user.id);
        if (!u) return null;
        const previous = [u.avatar, u.cardBackground];
        u.nickname = b.nickname!.toString().trim();
        u.avatar = typeof b.avatar === 'string' ? b.avatar.slice(0, 500) : u.avatar;
        u.selectedBadge = typeof b.selectedBadge === 'string' && (u.badges || []).includes(b.selectedBadge) ? b.selectedBadge : '';
        u.avatarFrame = b.avatarFrame === 'none' || b.avatarFrame === 'sakura' || b.avatarFrame === 'gold' || b.avatarFrame === 'glass' ? b.avatarFrame : 'none';
        u.cardBackground = typeof b.cardBackground === 'string' && (/^https:\/\//i.test(b.cardBackground) || b.cardBackground.startsWith('/uploads/') || b.cardBackground === '') ? b.cardBackground.slice(0, 1000) : u.cardBackground;
        return previous;
      });
      if (!previousProfileImages) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      await deleteUnreferencedStorageImages(previousProfileImages);
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'favorite') {
      const targetType = b.targetType as Collection['targetType'];
      if (!['game', 'guide', 'resource'].includes(targetType) || typeof b.targetId !== 'string') return NextResponse.json({ error: '收藏目标无效' }, { status: 400 });
      const result = await mutateDb((fresh) => {
        fresh.collections = fresh.collections || [];
        const idx = fresh.collections.findIndex((c) => c.userId === user.id && c.targetType === targetType && c.targetId === b.targetId);
        if (idx >= 0) {
          fresh.collections.splice(idx, 1);
          if (targetType === 'game') {
            const target = fresh.games.find((g) => g.id === b.targetId);
            if (target) target.favorites = Math.max(0, (target.favorites || 0) - 1);
          } else if (targetType === 'resource') {
            const target = fresh.resources.find((r) => r.id === b.targetId);
            if (target) target.favorites = Math.max(0, (target.favorites || 0) - 1);
          } else {
            const target = fresh.guides.find((g) => g.id === b.targetId);
            if (target) target.favorites = Math.max(0, (target.favorites || 0) - 1);
          }
          return false;
        }
        fresh.collections.push({ id: randomUUID(), userId: user.id, targetType, targetId: b.targetId, createdAt: now });
        if (targetType === 'guide') {
          const guide = fresh.guides.find((g) => g.id === b.targetId);
          if (guide) {
            guide.favorites = (guide.favorites || 0) + 1;
            guide.favoriteRewards = guide.favoriteRewards || [];
            if (guide.userId && guide.userId !== user.id && !guide.favoriteRewards.includes(user.id)) {
              const author = fresh.users.find((u) => u.id === guide.userId);
              if (author) author.exp += 2;
              guide.favoriteRewards.push(user.id);
            }
            if (guide.userId && guide.userId !== user.id) pushNotification(fresh, guide.userId, 'comment', '你的教程收到了收藏', `${user.nickname} 收藏了《${guide.title}》`, `/tutorials/${guide.id}`, user.id);
          }
        } else if (targetType === 'game') {
          const target = fresh.games.find((g) => g.id === b.targetId);
          if (target) target.favorites = (target.favorites || 0) + 1;
        } else {
          const target = fresh.resources.find((r) => r.id === b.targetId);
          if (target) target.favorites = (target.favorites || 0) + 1;
        }
        return true;
      });
      return NextResponse.json({ favorited: result });
    }
    if (b.action === 'comment-save') {
      if (!['game', 'guide', 'resource'].includes(String(b.targetType)) || !b.targetId || typeof b.content !== 'string' || b.content.trim().length < 1 || b.content.trim().length > 2000)
        return NextResponse.json({ error: '评论内容需为 1-2000 字' }, { status: 400 });
      if (b.targetType !== 'game' && b.targetType !== 'guide' && b.targetType !== 'resource') return NextResponse.json({ error: '无效的评论目标类型' }, { status: 400 });
      const targetType = b.targetType as Collection['targetType'];
      const result = await mutateDb((fresh) => {
        fresh.comments = fresh.comments || [];
        const c = { id: randomUUID(), targetType, targetId: String(b.targetId), userId: user.id, content: b.content!.toString().trim(), createdAt: now, likes: [] as string[], pinned: false, parentId: String(b.parentId || '') || undefined };
        fresh.comments.unshift(c);
        let recipient = '';
        if (c.parentId) {
          const parent = fresh.comments.find((x) => x.id === c.parentId);
          if (parent) recipient = parent.userId;
        }
        if (!recipient && c.targetType === 'guide') recipient = fresh.guides.find((x) => x.id === c.targetId)?.userId || '';
        if (recipient && recipient !== user.id) {
          const href = c.targetType === 'guide' ? `/tutorials/${c.targetId}` : c.targetType === 'resource' ? `/resources/${c.targetId}` : '/games';
          pushNotification(fresh, recipient, 'comment', c.parentId ? '有人回复了你的评论' : '你的内容收到了新评论', `${user.nickname}：${c.content.slice(0, 100)}`, href, user.id);
        }
        return true;
      });
      return NextResponse.json({ ok: result });
    }
    if (b.action === 'comment-like') {
      const result = await mutateDb((fresh) => {
        const c = fresh.comments.find((x) => x.id === b.id);
        if (!c || c.deleted) return { error: '评论不存在' as const };
        c.likes = c.likes || [];
        const i = c.likes.indexOf(user.id);
        if (i >= 0) c.likes.splice(i, 1);
        else {
          c.likes.push(user.id);
          if (c.userId !== user.id) {
            const href = c.targetType === 'guide' ? `/tutorials/${c.targetId}` : c.targetType === 'resource' ? `/resources/${c.targetId}` : `/games/${fresh.games.find((g) => g.id === c.targetId)?.slug || ''}`;
            pushNotification(fresh, c.userId, 'comment', '你的评论收到了点赞', `${user.nickname} 赞了你的评论`, href, user.id);
          }
        }
        return { liked: i < 0 };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 });
      return NextResponse.json(result);
    }
    if (b.action === 'comment-edit' || b.action === 'comment-delete' || b.action === 'comment-pin') {
      const c = db.comments.find((x) => x.id === b.id);
      if (!c) return NextResponse.json({ error: '评论不存在' }, { status: 404 });
      if (b.action === 'comment-pin') {
        await requireAdmin();
        c.pinned = !c.pinned;
      } else {
        if (c.userId !== user.id && user.role !== 'admin') return NextResponse.json({ error: '无权操作这条评论' }, { status: 403 });
        if (b.action === 'comment-delete') {
          const removeIds = new Set([c.id]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const child of db.comments) {
              if (child.parentId && removeIds.has(child.parentId) && !removeIds.has(child.id)) {
                removeIds.add(child.id);
                changed = true;
              }
            }
          }
          db.comments = db.comments.filter((x) => !removeIds.has(x.id));
          await writeDb(db);
          return NextResponse.json({ deleted: true, count: removeIds.size });
        } else {
          if (typeof b.content !== 'string' || !b.content.trim() || b.content.length > 2000) return NextResponse.json({ error: '修改内容需为 1-2000 字' }, { status: 400 });
          c.content = b.content.trim();
          c.updatedAt = now;
        }
      }
      await writeDb(db);
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'photo-save') {
      await requireAdmin();
      if (!b.title || !b.image) return NextResponse.json({ error: '照片标题和图片必填' }, { status: 400 });
      db.photos.unshift({
        id: randomUUID(),
        title: String(b.title).slice(0, 100),
        userId: user.id,
        username: user.username,
        description: String(b.description || '').slice(0, 1000),
        image: String(b.image),
        createdAt: now,
        downloads: 0,
        tags: Array.isArray(b.tags)
          ? b.tags
          : typeof b.tags === 'string'
            ? b.tags
                .split(',')
                .map((x: string) => x.trim())
                .filter(Boolean)
            : [],
      });
      await writeDb(db);
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'photo-delete') {
      await requireAdmin();
      const oldPhoto = db.photos.find((p) => p.id === String(b.id));
      if (!oldPhoto) return NextResponse.json({ error: '照片不存在' }, { status: 404 });
      db.photos = db.photos.filter((p) => p.id !== String(b.id));
      await writeDb(db);
      await deleteUnreferencedStorageImages([oldPhoto]);
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'wallet-convert') {
      const result = await mutateDb((fresh) => {
        const u = fresh.users.find((x) => x.id === user.id);
        if (!u) return { error: '用户不存在', status: 404 as const };
        const exp = Math.max(0, Math.floor(u.exp || 0));
        const converted = Math.max(0, Math.floor(u.expConverted || 0));
        const coins = Math.floor(Math.max(0, exp - converted) / 10);
        if (coins < 1) return { error: '可兑换经验不足 10 EXP', status: 400 as const };
        const before = Math.max(0, Math.floor(u.sakuraCoins || 0));
        u.expConverted = converted + coins * 10;
        u.sakuraCoins = before + coins;
        fresh.coinTransactions = fresh.coinTransactions || [];
        fresh.coinTransactions.unshift({
          id: randomUUID(),
          userId: user.id,
          type: 'conversion',
          amount: coins,
          balanceBefore: before,
          balanceAfter: u.sakuraCoins,
          description: `兑换 ${coins * 10} EXP`,
          createdAt: now,
        });
        return { coins, balance: u.sakuraCoins, expConverted: coins * 10 };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({
        ok: true,
        ...result,
        message: `兑换成功，获得 ${result.coins} 樱花币`,
      });
    }
    if (b.action === 'shop-buy') {
      const result = await mutateDb((fresh) => {
        const product = (fresh.shopProducts || []).find((x) => x.id === String(b.productId));
        if (!product || !product.active) return { error: '商品不存在或已下架', status: 404 as const };
        if (product.category === 'vip') return { error: 'VIP 会员权益尚未接入，暂不可购买', status: 400 as const };
        if (product.stock !== null && product.stock <= 0) return { error: '商品库存不足', status: 409 as const };
        const u = fresh.users.find((x) => x.id === user.id);
        if (!u) return { error: '用户不存在', status: 404 as const };
        const price = Math.max(0, Math.floor(product.price));
        const before = Math.max(0, Math.floor(u.sakuraCoins || 0));
        if (before < price) return { error: '樱花币余额不足', status: 400 as const };
        const owned = (fresh.inventory || []).some((x) => x.userId === user.id && x.productId === product.id);
        if (owned && ['avatar-frame', 'badge', 'card-background'].includes(product.category)) return { error: '你已经拥有该商品', status: 409 as const };
        u.sakuraCoins = before - price;
        if (product.stock !== null) product.stock = Math.max(0, product.stock - 1);
        fresh.inventory = fresh.inventory || [];
        fresh.inventory.unshift({
          id: randomUUID(),
          userId: user.id,
          productId: product.id,
          productName: product.name,
          category: product.category,
          purchasedAt: now,
          price,
        });
        fresh.coinTransactions = fresh.coinTransactions || [];
        fresh.coinTransactions.unshift({
          id: randomUUID(),
          userId: user.id,
          type: 'purchase',
          amount: -price,
          balanceBefore: before,
          balanceAfter: u.sakuraCoins,
          description: `购买商品：${product.name}`,
          createdAt: now,
          relatedId: product.id,
        });
        return { balance: u.sakuraCoins, name: product.name };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, ...result, message: `购买成功：${result.name}` });
    }
    if (b.action === 'inventory-equip') {
      const result = await mutateDb((fresh) => {
        const item = (fresh.inventory || []).find((x) => x.id === String(b.inventoryId) && x.userId === user.id);
        if (!item) return { error: '背包物品不存在', status: 404 as const };
        const product = (fresh.shopProducts || []).find((x) => x.id === item.productId);
        const u = fresh.users.find((x) => x.id === user.id);
        if (!u || !product) return { error: '商品资料不存在', status: 404 as const };
        if (item.category === 'avatar-frame') {
          if (!['sakura', 'gold', 'glass'].includes(product.effectValue || '')) return { error: '该头像框尚未配置可佩戴样式', status: 400 as const };
          u.avatarFrame = product.effectValue;
          return { message: '头像框佩戴成功' };
        }
        if (item.category === 'badge') {
          const badge = String(product.effectValue || product.name)
            .trim()
            .slice(0, 40);
          u.badges = u.badges || [];
          if (!u.badges.includes(badge)) u.badges.push(badge);
          u.selectedBadge = badge;
          return { message: '徽章已添加并佩戴' };
        }
        if (item.category === 'card-background') {
          if (!product.image || (!product.image.startsWith('https://') && !product.image.startsWith('/uploads/'))) return { error: '名片背景图片无效', status: 400 as const };
          u.cardBackground = product.image;
          return { message: '名片背景已应用' };
        }
        return { error: '该商品暂不支持直接装备', status: 400 as const };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, message: result.message });
    }
    if (b.action === 'feedback-update') {
      const title = typeof b.title === 'string' ? b.title : '';
      const description = typeof b.description === 'string' ? b.description : '';
      if (title.trim().length < 3 || description.trim().length < 5) return NextResponse.json({ error: '请填写标题和详细描述' }, { status: 400 });
      const feedbackId = String(b.id || '');
      const feedbackType = typeof b.type === 'string' ? b.type : '';
      const gameId = typeof b.gameId === 'string' ? b.gameId : '';
      const image = typeof b.image === 'string' ? b.image : '';
      const rawImages = b.images;
      const result = await mutateDb((fresh) => {
        const item = fresh.feedback.find((x) => x.id === feedbackId);
        if (!item) return { error: '反馈记录不存在', status: 404 };
        const isAdmin = user.role === 'admin';
        if (item.userId !== user.id && !isAdmin) return { error: '只有反馈提交者或管理员可以修改', status: 403 };
        if (!isAdmin && !['pending', 'processing', 'failed'].includes(item.status)) return { error: '已修复或已采纳的反馈不可由提交者修改', status: 409 };
        item.title = title.trim().slice(0, 100);
        item.type = (feedbackType || item.type).slice(0, 40);
        item.gameId = gameId.slice(0, 100);
        item.description = description.trim().slice(0, 10000);
        if (image) item.image = image.slice(0, 1000);
        item.images = (() => { let value: unknown = rawImages; if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = []; } } return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string' && (x.startsWith('https://') || x.startsWith('/uploads/'))).slice(0, 20) : item.images || []; })();
        return { ok: true };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, message: '反馈已更新' });
    }
    if (b.action === 'feedback-delete') {
      const result = await mutateDb((fresh) => {
        const item = fresh.feedback.find((x) => x.id === String(b.id) && x.userId === user.id);
        if (!item) return { error: '反馈记录不存在', status: 404 };
        if (item.status !== 'pending') return { error: '只有尚未处理的反馈可以撤回', status: 409 };
        fresh.feedback = fresh.feedback.filter((x) => x.id !== item.id);
        return { ok: true };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json({ ok: true, message: '反馈已撤回' });
    }
    if (b.action === 'feedback') {
      if (typeof b.title !== 'string' || b.title.trim().length < 3 || typeof b.description !== 'string' || b.description.trim().length < 5) return NextResponse.json({ error: '请填写标题和详细描述' }, { status: 400 });
      const submittedAt = new Date().toISOString();
      const feedbackId = randomUUID();
      const images = (() => { let value: unknown = b.images; if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = []; } } return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string' && (x.startsWith('https://') || x.startsWith('/uploads/'))).slice(0, 20) : []; })();
      await mutateDb((fresh) => {
        fresh.feedback.unshift({
          id: feedbackId, userId: user.id, username: user.username,
          title: (b.title as string).trim().slice(0, 100),
          type: String(b.type || '其他').slice(0, 40),
          gameId: String(b.gameId || '').slice(0, 100),
          description: (b.description as string).trim().slice(0, 10000),
          image: String(b.image || '').slice(0, 1000), images,
          status: 'pending', reply: '', createdAt: submittedAt,
          statusHistory: [{ status: 'pending', reply: '反馈已提交，等待管理员处理', at: submittedAt, by: user.nickname }],
        });
        for (const admin of fresh.users.filter((x) => x.role === 'admin' && x.status === 'active'))
          pushNotification(fresh, admin.id, 'feedback', '收到新的问题反馈', `${user.nickname} 提交了：${(b.title as string).trim().slice(0, 80)}`, '/admin#reviews', user.id);
      });
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'guide' || b.action === 'guide-edit' || b.action === 'guide-admin-create') {
      if (b.action === 'guide-admin-create') await requireAdmin();
      if (typeof b.title !== 'string' || b.title.trim().length < 3 || typeof b.content !== 'string' || b.content.trim().length < 20) return NextResponse.json({ error: '教程标题至少 3 字，正文至少 20 字' }, { status: 400 });
      const values = {
        author: user.nickname,
        gameId: String(b.gameId || ''),
        gameName: db.games.find((g) => g.id === b.gameId)?.name || '',
        title: b.title.trim().slice(0, 100),
        category: String(b.category || '教程'),
        date: now.slice(0, 10),
        updatedAt: now,
        content: b.content.trim().slice(0, 30000),
        cover: String(b.cover || ''),
        bodyImage: String(b.bodyImage || ''),
        bodyImages: (() => {
          let images: unknown = b.bodyImages;
          if (typeof images === 'string') {
            try {
              images = JSON.parse(images);
            } catch {
              images = [];
            }
          }
          return Array.isArray(images)
  ? images.filter((x): x is string => typeof x === 'string' && Boolean(x)).slice(0, 20)
  : [b.image1, b.image2, b.image3, b.image4, b.image5].filter(
      (x): x is string => typeof x === 'string' && Boolean(x)
    );
        })(),
      };
      if (b.action === 'guide-edit') {
        const old = db.guides.find((g) => g.id === b.id);
        if (!old) return NextResponse.json({ error: '教程不存在' }, { status: 404 });
        if (old.userId !== user.id && user.role !== 'admin') return NextResponse.json({ error: '只有教程作者或管理员可以修改' }, { status: 403 });
        const previousGuideImages = [old.cover, old.bodyImage, old.bodyImages, old.content];
        Object.assign(old, { ...values, author: old.author || user.nickname, date: old.date });
        if (old.userId === user.id) old.author = user.nickname;
        if (user.role !== 'admin' && old.status === 'rejected') old.status = 'pending';
        await writeDb(db);
        await deleteUnreferencedStorageImages(previousGuideImages);
        return NextResponse.json({ ok: true, message: '教程修改成功' });
      }
      db.guides.unshift({
        id: randomUUID(),
        userId: user.id,
        ...values,
        status: b.action === 'guide-admin-create' ? 'approved' : 'pending',
        views: 0,
        favorites: 0,
      });
      if (b.action === 'guide') {
        for (const admin of db.users.filter((x) => x.role === 'admin' && x.status === 'active'))
          pushNotification(db, admin.id, 'system', '收到新的教程投稿', user.nickname + ' 投稿了《' + values.title + '》，等待审核。', '/admin#reviews', user.id);
      }
      await writeDb(db);
      return NextResponse.json({ ok: true, message: b.action === 'guide-admin-create' ? '教程已发布并关联游戏' : '教程已提交审核' });
    }
    await requireAdmin();
    if (b.action === 'shop-product-save') {
      await requireAdmin();
      const name = String(b.name || '').trim();
      const price = Number(b.price);
      const category = String(b.category || 'other');
      if (name.length < 1 || name.length > 80 || !Number.isInteger(price) || price < 0 || price > 100000000) return NextResponse.json({ error: '请填写有效商品名称和价格' }, { status: 400 });
      if (!['avatar-frame', 'badge', 'card-background', 'vip', 'other'].includes(category)) return NextResponse.json({ error: '商品分类无效' }, { status: 400 });
      const old = (db.shopProducts || []).find((x) => x.id === String(b.id || ''));
      const stockRaw = String(b.stock ?? '').trim();
      const stock = stockRaw === '' ? -1 : Number(stockRaw);
      if (stock !== -1 && (!Number.isInteger(stock) || stock < 0)) return NextResponse.json({ error: '库存必须为非负整数，留空表示不限量' }, { status: 400 });
      const image = String(b.image || '').slice(0, 1000);
      const effectValue = String(b.effectValue || '').slice(0, 100);
      if (category === 'avatar-frame' && !['sakura', 'gold', 'glass'].includes(effectValue)) return NextResponse.json({ error: '头像框装饰标识必须为 sakura、gold 或 glass' }, { status: 400 });
      if (category === 'card-background' && !image) return NextResponse.json({ error: '名片背景商品必须上传图片' }, { status: 400 });
      const product = {
        id: old?.id || randomUUID(),
        name,
        description: String(b.description || '').slice(0, 2000),
        image,
        category: category as ShopProduct['category'],
        price,
        effectValue,
        active: b.active !== 'false',
        stock: stock === -1 ? null : stock,
        createdAt: old?.createdAt || now,
        updatedAt: now,
      };
      db.shopProducts = db.shopProducts || [];
      if (old) db.shopProducts[db.shopProducts.indexOf(old)] = product;
      else db.shopProducts.unshift(product);
      await writeDb(db);
      return NextResponse.json({ ok: true, message: old ? '商品已更新' : '商品已添加' });
    }
    if (b.action === 'shop-product-status') {
      await requireAdmin();
      const p = (db.shopProducts || []).find((x) => x.id === String(b.id));
      if (!p) return NextResponse.json({ error: '商品不存在' }, { status: 404 });
      p.active = b.active === 'true';
      p.updatedAt = now;
      await writeDb(db);
      return NextResponse.json({ ok: true, message: p.active ? '商品已上架' : '商品已下架' });
    }
    if (b.action === 'game-save') {
      await requireAdmin();
      const old = db.games.find((g) => g.id === b.id);
      const game: Game = {
        id: old?.id || randomUUID(),
        name: String(b.name || '').trim(),
        slug: String(b.slug || '').trim(),
        cover: String(b.cover || ''),
        genre: String(b.genre || ''),
        platforms: Array.isArray(b.platforms) ? b.platforms : typeof b.platforms === 'string' ? b.platforms.split(',').map((x: string) => x.trim()).filter(Boolean) : old?.platforms || [],
        status:
  b.status === '运营中' ||
  b.status === '测试中' ||
  b.status === '已停更'
    ? b.status
    : '运营中',
        latestVersion: String(b.latestVersion || ''),
        updatedAt: String(b.updatedAt || now.slice(0, 10)),
        description: String(b.description || ''),
        tags: Array.isArray(b.tags) ? b.tags : typeof b.tags === 'string' ? b.tags.split(',').map((x: string) => x.trim()).filter(Boolean) : old?.tags || [],
        updates: old?.updates || [],
        files: old?.files || [],
        guides: old?.guides || [],
        views: old?.views || 0,
        favorites: old?.favorites || 0,
        images: (() => {
          let value: unknown = b.images;
          if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = []; } }
          return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string' && (x.startsWith('https://') || x.startsWith('/uploads/'))).slice(0, 20) : old?.images || [];
        })(),
        config: {
  minimum:
    typeof b.minimum === 'string'
      ? b.minimum
      : old?.config?.minimum || '',
  recommended:
    typeof b.recommended === 'string'
      ? b.recommended
      : old?.config?.recommended || '',
},
      };
      if (!game.name || !/^[a-z0-9-]+$/.test(game.slug)) return NextResponse.json({ error: '名称必填，slug 只能使用小写英文、数字和连字符' }, { status: 400 });
      if (db.games.some((g) => g.slug === game.slug && g.id !== game.id)) return NextResponse.json({ error: 'slug 已存在' }, { status: 409 });
      if (old) db.games[db.games.indexOf(old)] = { ...game, updates: old.updates || [], files: old.files || [], guides: old.guides || [], views: old.views || 0, favorites: old.favorites || 0 };
      else db.games.unshift(game);
      await writeDb(db);
      if (old && old.cover !== game.cover) await deleteUnreferencedStorageImages([old.cover]);
      if (old) await deleteUnreferencedStorageImages((old.images || []).filter((image) => !(game.images || []).includes(image)));
      return NextResponse.json({ ok: true, id: game.id, message: old ? '游戏档案修改成功' : '游戏档案创建成功' });
    }
    if (b.action === 'game-record') {
      await requireAdmin();
      const game = db.games.find((g) => g.id === String(b.gameId || ''));
      if (!game) return NextResponse.json({ error: '游戏不存在' }, { status: 404 });
      const recordId = String(b.id || '') || randomUUID();
      if (b.kind === 'update') {
        if (!b.title || !b.version || !b.date) return NextResponse.json({ error: '版本号、标题和日期必填' }, { status: 400 });
        const old = game.updates.find((item) => item.id === recordId);
        if (b.id && !old) return NextResponse.json({ error: '版本记录不存在，请刷新后重试' }, { status: 404 });
        const next = {
          id: recordId,
          contributorId: old?.contributorId || user.id,
          contributorName: old?.contributorName || user.nickname,
          date: String(b.date),
          version: String(b.version),
          title: String(b.title),
          notes: String(b.notes || ''),
        };
        if (old) game.updates[game.updates.indexOf(old)] = next;
        else game.updates.unshift(next);
        if (!old || game.latestVersion === old.version) {
          game.latestVersion = next.version;
          game.updatedAt = next.date;
        }
      } else if (b.kind === 'file') {
        if (!b.name || !b.date) return NextResponse.json({ error: '资源名称和日期必填' }, { status: 400 });
        const old = game.files.find((item) => item.id === recordId);
        if (b.id && !old) return NextResponse.json({ error: '资源文件记录不存在，请刷新后重试' }, { status: 404 });
        const next = {
          id: recordId,
          name: String(b.name),
          version: String(b.version || ''),
          size: String(b.size || ''),
          checksum: String(b.checksum || ''),
          date: String(b.date),
          notes: String(b.notes || ''),
          url: String(b.url || ''),
        };
        if (old) game.files[game.files.indexOf(old)] = next;
        else game.files.unshift(next);
      } else return NextResponse.json({ error: '记录类型无效' }, { status: 400 });
      await writeDb(db);
      return NextResponse.json({ ok: true, message: b.id ? '记录修改成功' : '记录添加成功' });
    }
    if (b.action === 'game-delete') {
      await requireAdmin();
      const oldGame = db.games.find((g) => g.id === String(b.id));
      if (!oldGame) return NextResponse.json({ error: '游戏不存在' }, { status: 404 });
      db.games = db.games.filter((g) => g.id !== String(b.id));
      // Keep linked resources and tutorials, but detach them from the deleted game.
      db.resources = db.resources.map((resource) =>
        resource.gameId === oldGame.id ? { ...resource, gameId: '', gameName: '通用资源' } : resource,
      );
      db.guides = db.guides.map((guide) =>
        guide.gameId === oldGame.id ? { ...guide, gameId: undefined, gameName: undefined } : guide,
      );
      db.collections = db.collections.filter((item) => !(item.targetType === 'game' && item.targetId === oldGame.id));
      db.comments = db.comments.filter((item) => !(item.targetType === 'game' && item.targetId === oldGame.id));
      await writeDb(db);
      await deleteUnreferencedStorageImages([oldGame]);
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'resource-save') {
      await requireAdmin();
      const old = db.resources.find((x) => x.id === String(b.id || ''));
      const r: Resource = {
        id: old?.id || randomUUID(),
        userId: old?.userId || user.id,
        username: old?.username || user.nickname,
        title: String(b.title || '').trim(),
        cover: String(b.cover || ''),
        images: (() => { let value: unknown = b.images; if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = []; } } return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string' && (x.startsWith('https://') || x.startsWith('/uploads/'))).slice(0, 20) : old?.images || []; })(),
        gameId: String(b.gameId || ''),
        gameName: db.games.find((g) => g.id === String(b.gameId || ''))?.name || '',
        version: String(b.version || ''),
        description: String(b.description || ''),
        scope: String(b.scope || ''),
        install: String(b.install || ''),
        url: String(b.url || ''),
        tutorial: String(b.tutorial || ''),
        tags: Array.isArray(b.tags) ? b.tags : typeof b.tags === 'string' ? b.tags.split(',').map((x: string) => x.trim()).filter(Boolean) : [],
        updatedAt: now.slice(0, 10),
        views: old?.views || 0,
        favorites: old?.favorites || 0,
      };
      if (!r.title) return NextResponse.json({ error: '资源名称必填' }, { status: 400 });
      if (old) db.resources[db.resources.indexOf(old)] = r;
      else db.resources.unshift(r);
      await writeDb(db);
      if (old && (old.cover !== r.cover || JSON.stringify(old.images || []) !== JSON.stringify(r.images || []))) await deleteUnreferencedStorageImages([old.cover, old.images || []]);
      return NextResponse.json({ ok: true, message: old ? '资源修改成功' : '资源发布成功' });
    }
    if (b.action === 'notice-save') {
      await requireAdmin();
      const title = String(b.title || '').trim(),
        content = String(b.content || '').trim();
      if (!title || !content) return NextResponse.json({ error: '公告标题和正文必填' }, { status: 400 });
      const old = db.notices.find((x) => x.id === b.id);
      if (old) {
        old.history = old.history || [];
        old.history.unshift({
          id: randomUUID(),
          date: now,
          title: old.title,
          subtitle: old.subtitle,
          cover: old.cover,
          content: old.content,
        });
        Object.assign(old, {
          title,
          subtitle: String(b.subtitle || ''),
          cover: String(b.cover || ''),
          content,
          date: old.date || now.slice(0, 10),
          updatedAt: now,
          pinned: Boolean(b.pinned),
          published: Boolean(b.published),
          updatedBy: user.nickname,
          updatedById: user.id,
        });
      } else
        db.notices.unshift({
          id: randomUUID(),
          title,
          subtitle: String(b.subtitle || ''),
          cover: String(b.cover || ''),
          content,
          date: now.slice(0, 10),
          updatedAt: now,
          pinned: Boolean(b.pinned),
          published: Boolean(b.published),
          updatedBy: user.nickname,
          updatedById: user.id,
          history: [],
        });
      if (!old && b.published) {
        for (const recipient of db.users.filter((x) => x.status === 'active')) pushNotification(db, recipient.id, 'system', '网站发布了新公告', title, `/notices`, user.id);
      }
      await writeDb(db);
      return NextResponse.json({ ok: true, message: old ? '公告修改成功' : '公告发布成功' });
    }
    if (b.action === 'review-guide' || b.action === 'review-feedback') {
      await requireAdmin();
      const result = await mutateDb((fresh) => {
        const list = b.action === 'review-guide' ? fresh.guides : fresh.feedback;
        const item = list.find((x) => x.id === String(b.id || ''));
        if (!item) return { error: '记录不存在' };
        const accepted = b.status === 'accepted';
        if (b.action === 'review-guide') {
          const guide = item as Guide;
          const wasApproved = guide.status === 'approved';
          // Preserve the one-time reward marker when an already-approved guide is later rejected.
          if (wasApproved) guide.rewardGranted = true;
          guide.status = accepted ? 'approved' : 'rejected';
          if (accepted && !wasApproved && !guide.rewardGranted) {
            const owner = fresh.users.find((u) => u.id === item.userId);
            if (owner) {
              const oldLevel = levelOf(owner.exp);
              owner.exp += 30;
              guide.rewardGranted = true;
              pushNotification(fresh, owner.id, 'system', '教程审核奖励已发放', '教程《' + guide.title + '》通过审核，获得 30 EXP。', '/tutorials/' + guide.id, user.id);
              if (levelOf(owner.exp) > oldLevel) pushNotification(fresh, owner.id, 'level', '等级提升啦！', '恭喜升级至 Lv.' + levelOf(owner.exp) + '。', '/users/' + owner.id);
            }
          }
        } else {
          const feedback = item as Feedback;
          const previousStatus = feedback.status;
          const nextStatus = ['processing', 'fixed', 'failed'].includes(String(b.status)) ? String(b.status) : accepted ? 'accepted' : 'rejected';
          feedback.status = nextStatus as Feedback['status'];
          feedback.reply = String(b.reply || '');
          feedback.bugSeverity = ['warning', 'error', 'critical'].includes(String(b.severity)) ? b.severity as Feedback['bugSeverity'] : feedback.bugSeverity;
          feedback.statusHistory = feedback.statusHistory || [];
          feedback.statusHistory.push({ status: nextStatus, reply: feedback.reply, at: new Date().toISOString(), by: user.nickname });
          const isBug = /bug/i.test(feedback.type);
          const wasAlreadyRewardedStatus = previousStatus === 'accepted' || previousStatus === 'fixed';
          const finalReward = nextStatus === 'fixed' || nextStatus === 'accepted';
          if (finalReward && !feedback.rewardGranted && !wasAlreadyRewardedStatus) {
            const owner = fresh.users.find((u) => u.id === feedback.userId);
            if (owner) {
              const reward = isBug && nextStatus === 'fixed' ? feedback.bugSeverity === 'critical' ? 300 : feedback.bugSeverity === 'error' ? 150 : 50 : 100;
              const oldLevel = levelOf(owner.exp); owner.exp += reward; feedback.rewardGranted = true;
              pushNotification(fresh, owner.id, 'feedback', '反馈修复奖励已发放', '本次反馈获得 ' + reward + ' EXP。', '/users/' + owner.id);
              if (levelOf(owner.exp) > oldLevel) pushNotification(fresh, owner.id, 'level', '等级提升啦！', '恭喜升级至 Lv.' + levelOf(owner.exp) + '。', '/users/' + owner.id);
            }
          }
        }
        pushNotification(fresh, String(item.userId || ''), b.action === 'review-guide' ? 'system' : 'feedback', b.action === 'review-guide' ? (accepted ? '教程审核通过' : '教程审核未通过') : '反馈处理进度已更新', String(b.reply || (accepted ? '你的内容已通过审核。' : '管理员已更新处理状态。')), b.action === 'review-guide' ? '/tutorials/' + item.id : '/feedback', user.id);
        return { ok: true };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'admin-user-create') {
      await requireAdmin();
      const username = String(b.username || '').trim();
      const password = String(b.password || '');
      const nickname = String(b.nickname || username).trim();
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return NextResponse.json({ error: '用户名需为 3-24 位字母、数字或下划线' }, { status: 400 });
      if (password.length < 8) return NextResponse.json({ error: '初始密码至少 8 位' }, { status: 400 });
      if (db.users.some((x) => x.username.toLowerCase() === username.toLowerCase())) return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
      const role: 'user' | 'vip' =
  b.role === 'user' || b.role === 'vip' ? b.role : 'user';
      db.users.unshift({
        id: randomUUID(),
        username,
        passwordHash: await hashPassword(password),
        nickname: nickname.slice(0, 24),
        avatar: '',
        role,
        status: 'active',
        createdAt: now,
        exp: 0,
        badges: [],
        title: '',
      });
      await writeDb(db);
      return NextResponse.json({ ok: true, message: '账号创建成功' });
    }
    if (b.action === 'admin-user-update') {
      await requireAdmin();
      const target = db.users.find((x) => x.id === String(b.id));
      if (!target) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      if (target.id === user.id && b.role && b.role !== 'admin') return NextResponse.json({ error: '不能降低当前管理员自己的权限' }, { status: 400 });
      if (target.role === 'admin' && target.id !== user.id && b.role && b.role !== 'admin') return NextResponse.json({ error: '不能在此降级其他管理员' }, { status: 403 });
      if (target.role === 'admin' && target.id !== user.id && b.status === 'banned') return NextResponse.json({ error: '不能封禁其他管理员账号' }, { status: 403 });
      if (
  b.role === 'user' ||
  b.role === 'vip' ||
  b.role === 'admin'
) {
  target.role = b.role;
}

if (b.status === 'active' || b.status === 'banned') {
  target.status = b.status;
}
      if (typeof b.nickname === 'string' && b.nickname.trim()) target.nickname = b.nickname.trim().slice(0, 24);
      const oldExp = Math.max(0, Number(target.exp) || 0);
      const oldBadges = [...(target.badges || [])];
      if (b.exp !== undefined && Number.isFinite(Number(b.exp))) target.exp = Math.max(0, Math.min(1000000, Math.floor(Number(b.exp))));
      if (typeof b.title === 'string') target.title = b.title.trim().slice(0, 40);
      if (typeof b.badges === 'string') {
  target.badges = [...new Set<string>(
    b.badges.split(',').map((x: string) => x.trim()).filter(Boolean)
  )].slice(0, 30);
} else if (Array.isArray(b.badges)) {
  const badgeList = b.badges.filter(
    (x: unknown): x is string => typeof x === 'string'
  );

  target.badges = [...new Set<string>(
    badgeList.map((x: string) => x.trim()).filter(Boolean)
  )].slice(0, 30);
}
      if (target.selectedBadge && !(target.badges || []).includes(target.selectedBadge)) target.selectedBadge = '';
      if (target.exp > oldExp) {
        const gainedExp = target.exp - oldExp;
        pushNotification(
          db,
          target.id,
          'system',
          '获得经验值',
          `管理员为你增加了 ${gainedExp} EXP，当前经验为 ${target.exp} EXP。`,
          `/users/${target.id}`,
          user.id,
        );
      }
      if (levelOf(target.exp) > levelOf(oldExp)) {
        pushNotification(
          db,
          target.id,
          'level',
          '等级提升啦！',
          `管理员调整经验后，你已达到 Lv.${levelOf(target.exp)}。`,
          `/users/${target.id}`,
        );
      }
      for (const badge of target.badges || []) {
        if (!oldBadges.includes(badge)) pushNotification(db, target.id, 'badge', '获得新徽章', `管理员授予你徽章：${badge}`, `/users/${target.id}`, user.id);
      }
      await writeDb(db);
      return NextResponse.json({ ok: true, message: '账户资料、经验与徽章已更新' });
    }
    if (b.action === 'admin-user-delete') {
      await requireAdmin();
      const result = await mutateDb((fresh) => {
        const target = fresh.users.find((x) => x.id === String(b.id));
        if (!target) return { error: '用户不存在', status: 404 as const };
        if (target.id === user.id) return { error: '不能删除当前登录账号', status: 400 as const };
        if (target.role === 'admin') return { error: '不能删除管理员账号', status: 403 as const };
        const profileImages = [target.avatar, target.cardBackground];
        fresh.users = fresh.users.filter((x) => x.id !== target.id);
        fresh.collections = (fresh.collections || []).filter((x) => x.userId !== target.id);
        fresh.comments = (fresh.comments || [])
          .filter((x) => x.userId !== target.id)
          .map((comment) => ({
            ...comment,
            likes: (comment.likes || []).filter((id) => id !== target.id),
          }));
        fresh.messages = (fresh.messages || []).filter((x) => x.fromId !== target.id && x.toId !== target.id);
        fresh.friendships = (fresh.friendships || []).filter(
          (x) => x.requesterId !== target.id && x.addresseeId !== target.id,
        );
        fresh.notifications = (fresh.notifications || [])
          .filter((x) => x.userId !== target.id)
          .map((notification) => notification.actorId === target.id
            ? { ...notification, actorId: undefined }
            : notification);
        fresh.loginLogs = (fresh.loginLogs || []).filter((x) => x.userId !== target.id);
        fresh.inventory = (fresh.inventory || []).filter((x) => x.userId !== target.id);
        fresh.coinTransactions = (fresh.coinTransactions || []).filter((x) => x.userId !== target.id);
        // 保留已发布内容及其展示名称，但解除指向已删除账号的主页关联。
        fresh.guides = (fresh.guides || []).map((guide) =>
          guide.userId === target.id ? { ...guide, userId: undefined } : guide,
        );
        fresh.resources = (fresh.resources || []).map((resource) =>
          resource.userId === target.id ? { ...resource, userId: undefined } : resource,
        );
        fresh.photos = (fresh.photos || []).map((photo) =>
          photo.userId === target.id ? { ...photo, userId: undefined } : photo,
        );
        fresh.feedback = (fresh.feedback || []).map((feedback) =>
          feedback.userId === target.id ? { ...feedback, userId: '' } : feedback,
        );
        fresh.contributors = (fresh.contributors || []).map((contributor) =>
          contributor.userId === target.id ? { ...contributor, userId: undefined } : contributor,
        );
        fresh.notices = (fresh.notices || []).map((notice) =>
          notice.updatedById === target.id ? { ...notice, updatedById: undefined } : notice,
        );
        for (const game of fresh.games || []) {
          game.updates = (game.updates || []).map((update) =>
            update.contributorId === target.id ? { ...update, contributorId: undefined } : update,
          );
        }
        return { ok: true as const, profileImages };
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
      let cleanupWarning = '';
      try {
        await deleteUnreferencedStorageImages(result.profileImages);
      } catch (cleanupError) {
        // Account deletion is already committed; never report the primary operation as failed.
        console.error('账号已删除，但个人图片清理失败:', cleanupError);
        cleanupWarning = '；个人头像或背景图片清理失败，需稍后由管理员处理';
      }
      return NextResponse.json({
        ok: true,
        message: `账号已删除；相关好友关系、私信及个人记录已清理，已发布内容保留并解除账号关联${cleanupWarning}`,
        warning: cleanupWarning ? 'PROFILE_IMAGE_CLEANUP_FAILED' : undefined,
      });
    }
    if (b.action === 'site-background' || b.action === 'site-branding') {
      await requireAdmin();
      db.siteSettings = {
        ...(db.siteSettings || {}),
        ...(typeof b.background === 'string' ? { background: b.background } : {}),
        ...(typeof b.logo === 'string' ? { logo: b.logo } : {}),
        ...(typeof b.heroLogo === 'string' ? { heroLogo: b.heroLogo } : {}),
        ...(typeof b.homeBackground === 'string' ? { homeBackground: b.homeBackground } : {}),
        ...(typeof b.backgroundOpacity === 'string' || typeof b.backgroundOpacity === 'number' ? { backgroundOpacity: Math.max(10, Math.min(100, Number(b.backgroundOpacity) || 70)) } : {}),
        ...(typeof b.panelOpacity === 'string' || typeof b.panelOpacity === 'number' ? { panelOpacity: Math.max(35, Math.min(100, Number(b.panelOpacity) || 88)) } : {}),
        ...(typeof b.cardOpacity === 'string' || typeof b.cardOpacity === 'number' ? { cardOpacity: Math.max(35, Math.min(100, Number(b.cardOpacity) || 90)) } : {}),
        ...(typeof b.navOpacity === 'string' || typeof b.navOpacity === 'number' ? { navOpacity: Math.max(35, Math.min(100, Number(b.navOpacity) || 92)) } : {}),
        ...(typeof b.popupOpacity === 'string' || typeof b.popupOpacity === 'number' ? { popupOpacity: Math.max(35, Math.min(100, Number(b.popupOpacity) || 94)) } : {}),
        ...(typeof b.defaultThemeColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.defaultThemeColor) ? { defaultThemeColor: b.defaultThemeColor } : {}),
        ...(b.defaultThemeMode === 'light' || b.defaultThemeMode === 'dark' ? { defaultThemeMode: b.defaultThemeMode } : {}),
        ...(typeof b.sakuraEnabled === 'boolean' ? { sakuraEnabled: b.sakuraEnabled } : typeof b.sakuraEnabled === 'string' ? { sakuraEnabled: b.sakuraEnabled === 'true' } : {}),
      };
      await writeDb(db);
      return NextResponse.json({ ok: true, message: '站点外观已保存' });
    }
    if (b.action === 'contributor-settings') {
      await requireAdmin();
      const oldContributorImages = [db.siteSettings?.contributor?.avatar, db.siteSettings?.contributor?.donationQr, db.siteSettings?.contributorBackground];
      const contributions = String(b.contributions || '')
        .split('\n')
        .map((x: string) => x.trim())
        .filter(Boolean)
        .slice(0, 40);
      db.siteSettings = db.siteSettings || {};
      if (typeof b.contributorBackground === 'string') {
        db.siteSettings.contributorBackground = b.contributorBackground.slice(0, 1000);
      }
      db.siteSettings.contributor = {
        nickname: String(b.nickname || '开发者').slice(0, 40),
        avatar: String(b.developerAvatar || '').slice(0, 1000),
        level: String(b.level || '').slice(0, 60),
        github: String(b.github || '').slice(0, 300),
        bilibili: String(b.bilibili || '').slice(0, 300),
        qq: String(b.qq || '').slice(0, 60),
        email: String(b.email || '').slice(0, 160),
        intro: String(b.intro || '').slice(0, 2000),
        donationQr: String(b.donationQr || '').slice(0, 1000),
        contributions,
      };
      await writeDb(db);
      await deleteUnreferencedStorageImages(oldContributorImages);
      return NextResponse.json({ ok: true, message: '开发者资料已保存' });
    }
    if (b.action === 'contributor-settings-delete') {
      await requireAdmin();
      const oldImages = [db.siteSettings?.contributor?.avatar, db.siteSettings?.contributor?.donationQr, db.siteSettings?.contributorBackground];
      db.siteSettings = db.siteSettings || {};
      delete db.siteSettings.contributor;
      delete db.siteSettings.contributorBackground;
      await writeDb(db);
      await deleteUnreferencedStorageImages(oldImages);
      return NextResponse.json({ ok: true, message: '开发者资料已删除，贡献者名单未受影响' });
    }
    if (b.action === 'contributor-add' || b.action === 'contributor-update') {
      await requireAdmin();
      const name = String(b.name || '').trim(), description = String(b.description || '').trim();
      if (!name || !description) return NextResponse.json({ error: '贡献者昵称和贡献说明必填' }, { status: 400 });
      db.contributors = db.contributors || [];
      const old = b.action === 'contributor-update' ? db.contributors.find((x) => x.id === String(b.id)) : undefined;
      if (b.action === 'contributor-update' && !old) return NextResponse.json({ error: '贡献者记录不存在' }, { status: 404 });
      const kind: 'volunteer' | 'technical' | 'content' | 'financial' =
        b.kind === 'volunteer' || b.kind === 'content' || b.kind === 'financial' || b.kind === 'technical'
          ? b.kind
          : 'volunteer';
      const item = {
        id: old?.id || randomUUID(),
        name: name.slice(0, 60),
        role: String(b.role || '社区贡献者').slice(0, 80),
        description: description.slice(0, 1000),
        kind,
        userId: String(b.userId || '') || undefined,
        avatar: String(b.avatar || '').slice(0, 1000),
        exp: Math.max(0, Math.min(1000000, Math.floor(Number(b.exp) || 0))),
        badges: [...new Set(String(b.badges || '').split(',').map((x: string) => x.trim()).filter(Boolean))].slice(0, 30),
        createdAt: old?.createdAt || now,
      };
      if (old) db.contributors[db.contributors.indexOf(old)] = item;
      else db.contributors.unshift(item);
      await writeDb(db);
      if (old && old.avatar !== item.avatar) await deleteUnreferencedStorageImages([old.avatar]);
      return NextResponse.json({ ok: true, message: old ? '贡献者资料修改成功' : '贡献者已添加' });
    }
    if (b.action === 'contributor-delete') {
      await requireAdmin();
      const old = (db.contributors || []).find((x) => x.id === String(b.id));
      if (!old) return NextResponse.json({ error: '贡献者记录不存在' }, { status: 404 });
      db.contributors = (db.contributors || []).filter((x) => x.id !== String(b.id));
      await writeDb(db);
      await deleteUnreferencedStorageImages([old.avatar]);
      return NextResponse.json({ ok: true, message: '贡献者记录已移除' });
    }
    if (b.action === 'user-update') {
      await requireAdmin();
      const u = db.users.find((x) => x.id === b.id);
      if (!u) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      const oldExp = u.exp;
      const oldStatus = u.status;
      const oldBadges = [...(u.badges || [])];
      if (
  b.role === 'user' ||
  b.role === 'vip' ||
  b.role === 'admin'
) {
  u.role = b.role;
}

if (b.status === 'active' || b.status === 'banned') {
  u.status = b.status;
}
      if (typeof b.exp === 'number' && Number.isFinite(b.exp)) u.exp = Math.max(0, Math.min(1000000, Math.floor(b.exp)));
      if (typeof b.title === 'string') u.title = b.title.slice(0, 40);
      if (Array.isArray(b.badges)) u.badges = b.badges.filter((x: unknown) => typeof x === 'string').slice(0, 20);
      if (typeof b.badges === 'string')
        u.badges = b.badges
          .split(',')
          .map((x: string) => x.trim())
          .filter(Boolean)
          .slice(0, 20);
      if (levelOf(u.exp) > levelOf(oldExp)) pushNotification(db, u.id, 'level', '等级提升啦！', `恭喜升级至 Lv.${levelOf(u.exp)}。`, `/users/${u.id}`);
      if (oldStatus !== 'banned' && u.status === 'banned') pushNotification(db, u.id, 'system', '账号状态发生变化', '你的账号已被管理员封禁。请联系管理员了解详情。', '/profile');
      for (const badge of u.badges || []) if (!oldBadges.includes(badge)) pushNotification(db, u.id, 'badge', '获得新徽章', `你获得了徽章：${badge}`, `/users/${u.id}`);
      await writeDb(db);
      return NextResponse.json({ ok: true });
    }
    if (b.action === 'resource-delete' || b.action === 'notice-delete' || b.action === 'guide-delete' || b.action === 'game-record-delete') {
      await requireAdmin();
      const removedImages: unknown[] = [];
      if (b.action === 'resource-delete') {
        const old = db.resources.find((x) => x.id === String(b.id));
        if (!old) return NextResponse.json({ error: '资源不存在' }, { status: 404 });
        removedImages.push(old);
        db.resources = db.resources.filter((x) => x.id !== String(b.id));
        db.collections = db.collections.filter((x) => !(x.targetType === 'resource' && x.targetId === String(b.id)));
        db.comments = db.comments.filter((x) => !(x.targetType === 'resource' && x.targetId === String(b.id)));
      }
      if (b.action === 'notice-delete') db.notices = db.notices.filter((x) => x.id !== String(b.id));
      if (b.action === 'guide-delete') {
        const old = db.guides.find((x) => x.id === String(b.id));
        if (!old) return NextResponse.json({ error: '教程不存在' }, { status: 404 });
        removedImages.push(old);
        db.guides = db.guides.filter((x) => x.id !== String(b.id));
        db.collections = db.collections.filter((x) => !(x.targetType === 'guide' && x.targetId === String(b.id)));
        db.comments = db.comments.filter((x) => !(x.targetType === 'guide' && x.targetId === String(b.id)));
      }
      if (b.action === 'game-record-delete') {
        const g = db.games.find((x) => x.id === String(b.gameId));
        if (!g) return NextResponse.json({ error: '游戏不存在' }, { status: 404 });
        if (b.kind === 'update') {
          const old = g.updates.find((x) => x.id === String(b.id));
          if (!old) return NextResponse.json({ error: '版本记录不存在' }, { status: 404 });
          removedImages.push(old);
          g.updates = g.updates.filter((x) => x.id !== String(b.id));
          if (g.latestVersion === old.version) {
            const latest = [...g.updates].sort((a, b) => b.date.localeCompare(a.date))[0];
            g.latestVersion = latest?.version || '';
            g.updatedAt = latest?.date || '';
          }
        } else if (b.kind === 'file') {
          const old = g.files.find((x) => x.id === String(b.id));
          if (!old) return NextResponse.json({ error: '资源文件记录不存在' }, { status: 404 });
          removedImages.push(old);
          g.files = g.files.filter((x) => x.id !== String(b.id));
        } else return NextResponse.json({ error: '记录类型无效' }, { status: 400 });
      }
      await writeDb(db);
      if (removedImages.length) await deleteUnreferencedStorageImages(removedImages);
      return NextResponse.json({ ok: true, message: '已删除' });
    }
    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e) {
    return err(e);
  }
}
function levelOf(exp: number) {
  const thresholds = [0, 50, 120, 220, 350, 500, 680, 880, 1100, 1350, 1650, 2000, 2400, 2850, 3350, 3900, 4500, 5150, 5850, 6600, 7400, 8250, 9150, 10100, 11100, 12200, 13400, 14700, 16100, 17600];
  let level = 1;
  thresholds.forEach((n, i) => {
    if (exp >= n) level = i + 1;
  });
  return level;
}
