import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import type { Database, Game, Guide, ShopProduct } from "./types";
import { db } from "./postgres";
import {
  appRevisions, users, games, gameImages, gameUpdates, gameFiles,
  guides, guideImages, guideStatusHistory, resources, resourceImages,
  feedback, feedbackImages, feedbackStatusHistory, notices, noticeHistory,
  collections, comments, commentLikes, photos, shopProducts, inventory,
  coinTransactions, loginLogs, directMessages, friendships, notifications,
  contributors, siteSettings,
} from "@/drizzle/schema";

type Executor = typeof db;
const readVersions = new WeakMap<Database, number>();

const iso = (value: Date | string | null | undefined): string | undefined => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
const date = (value: string | undefined, fallback = new Date()) => value ? new Date(value) : fallback;

export function createDefaultShopProducts(): ShopProduct[] {
  const now = new Date().toISOString();
  return [
    { id: "frame-sakura", name: "樱花头像框", description: "柔和的樱花主题头像装饰。", image: "", category: "avatar-frame", price: 50, active: true, stock: null, effectValue: "sakura", createdAt: now, updatedAt: now },
    { id: "frame-gold", name: "鎏金头像框", description: "金色边框装饰。", image: "", category: "avatar-frame", price: 100, active: true, stock: null, effectValue: "gold", createdAt: now, updatedAt: now },
    { id: "frame-glass", name: "星璃头像框", description: "玻璃质感头像装饰。", image: "", category: "avatar-frame", price: 150, active: true, stock: null, effectValue: "glass", createdAt: now, updatedAt: now },
  ];
}

const empty = (): Database => ({
  users: [], games: [], resources: [], guides: [], feedback: [], notices: [],
  collections: [], loginLogs: [], comments: [], photos: [], siteSettings: {},
  shopProducts: createDefaultShopProducts(), inventory: [], coinTransactions: [],
  messages: [], friendships: [], notifications: [], contributors: [],
});

function normalizeDb(raw: Partial<Database>): Database {
  const defaults = empty();
  return {
    ...defaults, ...raw,
    users: (raw.users || []).map((user) => ({
      ...user, sakuraCoins: Math.max(0, Number(user.sakuraCoins) || 0),
      expConverted: Math.max(0, Number(user.expConverted) || 0),
    })),
    shopProducts: raw.shopProducts?.length ? raw.shopProducts : defaults.shopProducts,
    inventory: raw.inventory || [], coinTransactions: raw.coinTransactions || [],
    messages: raw.messages || [], friendships: raw.friendships || [],
    notifications: raw.notifications || [], contributors: raw.contributors || [],
    games: (raw.games || []).map((game) => ({
      ...game, views: game.views || 0, favorites: game.favorites || 0,
      updates: game.updates || [], files: game.files || [], guides: game.guides || [],
    })),
    comments: raw.comments || [], photos: raw.photos || [],
    siteSettings: raw.siteSettings || {},
  };
}

async function ensureRevision(client: Executor) {
  let [row] = await client.select({ revision: appRevisions.revision })
    .from(appRevisions).where(eq(appRevisions.id, "main")).limit(1);
  if (!row) {
    await client.insert(appRevisions).values({ id: "main", revision: 0 }).onConflictDoNothing();
    [row] = await client.select({ revision: appRevisions.revision })
      .from(appRevisions).where(eq(appRevisions.id, "main")).limit(1);
  }
  if (!row) throw new Error("无法初始化 PostgreSQL 数据版本记录");
  return Number(row.revision);
}

async function loadSnapshot(client: Executor): Promise<Database> {
  const [
    userRows, gameRows, gameImageRows, updateRows, fileRows,
    guideRows, guideImageRows, guideHistoryRows, resourceRows, resourceImageRows,
    feedbackRows, feedbackImageRows, feedbackHistoryRows, noticeRows, noticeHistoryRows,
    collectionRows, commentRows, likeRows, photoRows, productRows, inventoryRows,
    transactionRows, loginRows, messageRows, friendshipRows, notificationRows,
    contributorRows, settingRows,
  ] = await Promise.all([
    client.select().from(users), client.select().from(games), client.select().from(gameImages),
    client.select().from(gameUpdates), client.select().from(gameFiles), client.select().from(guides),
    client.select().from(guideImages), client.select().from(guideStatusHistory),
    client.select().from(resources), client.select().from(resourceImages),
    client.select().from(feedback), client.select().from(feedbackImages),
    client.select().from(feedbackStatusHistory), client.select().from(notices),
    client.select().from(noticeHistory), client.select().from(collections),
    client.select().from(comments), client.select().from(commentLikes), client.select().from(photos),
    client.select().from(shopProducts), client.select().from(inventory),
    client.select().from(coinTransactions), client.select().from(loginLogs),
    client.select().from(directMessages), client.select().from(friendships),
    client.select().from(notifications), client.select().from(contributors),
    client.select().from(siteSettings),
  ]);

  const gameImagesById = group(gameImageRows, (row) => row.gameId);
  const updatesByGame = group(updateRows, (row) => row.gameId);
  const filesByGame = group(fileRows, (row) => row.gameId);
  const guideImagesById = group(guideImageRows, (row) => row.guideId);
  const guideHistoryById = group(guideHistoryRows, (row) => row.guideId);
  const resourceImagesById = group(resourceImageRows, (row) => row.resourceId);
  const feedbackImagesById = group(feedbackImageRows, (row) => row.feedbackId);
  const feedbackHistoryById = group(feedbackHistoryRows, (row) => row.feedbackId);
  const noticeHistoryById = group(noticeHistoryRows, (row) => row.noticeId);
  const likesByComment = group(likeRows, (row) => row.commentId);

  const guidesData: Guide[] = guideRows.map((row) => ({
    id: row.id, userId: row.userId ?? undefined, author: row.author ?? undefined,
    gameId: row.gameId ?? undefined, gameName: row.gameName ?? undefined,
    title: row.title, category: row.category, tags: row.tags || [], date: row.date,
    content: row.content, cover: row.cover ?? undefined, bodyImage: row.bodyImage ?? undefined,
    bodyImages: (guideImagesById.get(row.id) || []).sort(byOrder).map((item) => item.url),
    status: row.status as Guide["status"], updatedAt: iso(row.updatedAt),
    statusHistory: (guideHistoryById.get(row.id) || []).sort(byCreated).map((item) => ({
      status: item.status, reply: item.reply, at: iso(item.at) || "", by: item.by,
    })),
    views: row.views, favorites: row.favorites, rewardGranted: row.rewardGranted,
  }));

  const gamesData: Game[] = gameRows.map((row) => ({
    id: row.id, name: row.name, slug: row.slug, cover: row.cover, genre: row.genre,
    platforms: row.platforms || [], status: row.status as Game["status"],
    latestVersion: row.latestVersion, updatedAt: iso(row.updatedAt) || "",
    description: row.description, tags: row.tags || [],
    updates: (updatesByGame.get(row.id) || []).map((item) => ({
      id: item.id, contributorId: item.contributorId ?? undefined,
      contributorName: item.contributorName ?? undefined, date: item.date,
      version: item.version, title: item.title, notes: item.notes,
    })),
    files: (filesByGame.get(row.id) || []).map((item) => ({
      id: item.id, name: item.name, version: item.version, size: item.size,
      checksum: item.checksum, date: item.date, notes: item.notes, url: item.url ?? undefined,
    })),
    guides: guidesData.filter((guide) => guide.gameId === row.id),
    images: (gameImagesById.get(row.id) || []).sort(byOrder).map((item) => item.url),
    views: row.views, favorites: row.favorites,
    config: row.minimumConfig || row.recommendedConfig
      ? { minimum: row.minimumConfig || "", recommended: row.recommendedConfig || "" }
      : undefined,
  }));

  const settings: Record<string, unknown> = {};
  for (const row of settingRows) {
    try { settings[row.key] = JSON.parse(row.value); }
    catch { settings[row.key] = row.value; }
  }

  return normalizeDb({
    users: userRows.map((row) => ({
      id: row.id, username: row.username, email: row.email,
      emailVerifiedAt: iso(row.emailVerifiedAt), passwordHash: row.passwordHash || "",
      nickname: row.nickname, avatar: row.avatar, role: row.role as Database["users"][number]["role"],
      status: row.status as Database["users"][number]["status"], createdAt: iso(row.createdAt) || "",
      exp: row.exp, badges: row.badges || [], title: row.title,
      lastLoginAt: iso(row.lastLoginAt), lastLoginIp: row.lastLoginIp ?? undefined,
      lastDailyLogin: row.lastDailyLogin ?? undefined, lastCheckIn: row.lastCheckIn ?? undefined,
      selectedBadge: row.selectedBadge ?? undefined, avatarFrame: row.avatarFrame ?? undefined,
      cardBackground: row.cardBackground ?? undefined, sakuraCoins: row.sakuraCoins,
      expConverted: row.expConverted, themeColor: row.themeColor ?? undefined,
      themeMode: (row.themeMode as Database["users"][number]["themeMode"]) ?? undefined,
      sakuraEnabled: row.sakuraEnabled, discoverable: row.discoverable,
    })),
    games: gamesData,
    resources: resourceRows.map((row) => ({
      id: row.id, userId: row.userId ?? undefined, username: row.username ?? undefined,
      title: row.title, cover: row.cover, images: (resourceImagesById.get(row.id) || []).sort(byOrder).map((item) => item.url),
      gameId: row.gameId, gameName: row.gameName, version: row.version,
      description: row.description, scope: row.scope, install: row.install, url: row.url,
      tutorial: row.tutorial, tags: row.tags || [], updatedAt: iso(row.updatedAt) || "",
      views: row.views, favorites: row.favorites,
    })),
    guides: guidesData,
    feedback: feedbackRows.map((row) => ({
      id: row.id, userId: row.userId, username: row.username, title: row.title,
      type: row.type, gameId: row.gameId, description: row.description, image: row.image,
      images: (feedbackImagesById.get(row.id) || []).sort(byOrder).map((item) => item.url),
      status: row.status as Database["feedback"][number]["status"], reply: row.reply,
      createdAt: iso(row.createdAt) || "",
      statusHistory: (feedbackHistoryById.get(row.id) || []).sort(byCreated).map((item) => ({
        status: item.status, reply: item.reply, at: iso(item.at) || "", by: item.by,
      })),
      bugSeverity: row.bugSeverity as Database["feedback"][number]["bugSeverity"],
      rewardGranted: row.rewardGranted,
    })),
    notices: noticeRows.map((row) => ({
      id: row.id, title: row.title, subtitle: row.subtitle, cover: row.cover,
      content: row.content, date: row.date, pinned: row.pinned, published: row.published,
      updatedBy: row.updatedBy, updatedById: row.updatedById ?? undefined,
      updatedAt: iso(row.updatedAt),
      history: (noticeHistoryById.get(row.id) || []).sort(byCreated).map((item) => ({
        id: item.id, date: item.date, content: item.content, title: item.title,
        subtitle: item.subtitle, cover: item.cover,
      })),
    })),
    collections: collectionRows.map((row) => ({
      id: row.id, userId: row.userId, targetType: row.targetType as Database["collections"][number]["targetType"],
      targetId: row.targetId, createdAt: iso(row.createdAt) || "",
    })),
    comments: commentRows.map((row) => ({
      id: row.id, targetType: row.targetType as Database["comments"][number]["targetType"],
      targetId: row.targetId, userId: row.userId, content: row.content,
      createdAt: iso(row.createdAt) || "", updatedAt: iso(row.updatedAt),
      parentId: row.parentId ?? undefined, likes: (likesByComment.get(row.id) || []).map((item) => item.userId),
      pinned: row.pinned, deleted: row.deleted,
    })),
    photos: photoRows.map((row) => ({
      id: row.id, userId: row.userId ?? undefined, username: row.username ?? undefined,
      title: row.title, description: row.description, image: row.image,
      createdAt: iso(row.createdAt) || "", downloads: row.downloads, tags: row.tags || [],
    })),
    shopProducts: productRows.map((row) => ({
      id: row.id, name: row.name, description: row.description, image: row.image,
      category: row.category as ShopProduct["category"], price: row.price,
      active: row.active, stock: row.stock, effectValue: row.effectValue ?? undefined,
      createdAt: iso(row.createdAt) || "", updatedAt: iso(row.updatedAt) || "",
    })),
    inventory: inventoryRows.map((row) => ({
      id: row.id, userId: row.userId, productId: row.productId, productName: row.productName,
      category: row.category as ShopProduct["category"], purchasedAt: iso(row.purchasedAt) || "",
      price: row.price,
    })),
    coinTransactions: transactionRows.map((row) => ({
      id: row.id, userId: row.userId, type: row.type as "conversion" | "purchase" | "admin-adjustment",
      amount: row.amount, balanceBefore: row.balanceBefore, balanceAfter: row.balanceAfter,
      description: row.description, createdAt: iso(row.createdAt) || "", relatedId: row.relatedId ?? undefined,
    })),
    loginLogs: loginRows.map((row) => ({
      id: row.id, userId: row.userId, username: row.username, ip: row.ip, date: iso(row.date) || "",
    })),
    messages: messageRows.map((row) => ({
      id: row.id, fromId: row.fromId, toId: row.toId, content: row.content,
      createdAt: iso(row.createdAt) || "", readAt: iso(row.readAt),
    })),
    friendships: friendshipRows.map((row) => ({
      id: row.id, requesterId: row.requesterId, addresseeId: row.addresseeId,
      status: row.status as "pending" | "accepted" | "rejected",
      createdAt: iso(row.createdAt) || "", updatedAt: iso(row.updatedAt) || "",
    })),
    notifications: notificationRows.map((row) => ({
      id: row.id, userId: row.userId, type: row.type as "message" | "comment" | "feedback" | "badge" | "level" | "system",
      title: row.title, body: row.body, href: row.href, createdAt: iso(row.createdAt) || "",
      readAt: iso(row.readAt), actorId: row.actorId ?? undefined,
    })),
    contributors: contributorRows.map((row) => ({
      id: row.id, name: row.name, role: row.role, description: row.description,
      kind: row.kind as "volunteer" | "content" | "financial" | "technical",
      userId: row.userId ?? undefined, avatar: row.avatar ?? undefined,
      exp: row.exp, badges: row.badges || [], createdAt: iso(row.createdAt) || "",
    })),
    siteSettings: settings as unknown as Database["siteSettings"],
  });
}

function group<T, K>(rows: T[], key: (row: T) => K) {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const value = key(row);
    const list = map.get(value) || [];
    list.push(row);
    map.set(value, list);
  }
  return map;
}
function byOrder(a: { sortOrder: number }, b: { sortOrder: number }) { return a.sortOrder - b.sortOrder; }
function byCreated(a: { at: Date }, b: { at: Date }) { return a.at.getTime() - b.at.getTime(); }

async function persistSnapshot(client: Executor, source: Database) {
  const data = normalizeDb(source);
  const now = new Date();

  if (data.users.length) {
    const userRows = data.users.map((user) => ({
      id: user.id, username: user.username, email: user.email || `${user.username}@local.invalid`,
      emailVerifiedAt: user.emailVerifiedAt ? date(user.emailVerifiedAt) : null,
      passwordHash: user.passwordHash || null, nickname: user.nickname, avatar: user.avatar || "",
      role: user.role, status: user.status, exp: user.exp || 0, badges: user.badges || [],
      title: user.title || "见习档案员", lastLoginAt: user.lastLoginAt ? date(user.lastLoginAt) : null,
      lastLoginIp: user.lastLoginIp || null, lastDailyLogin: user.lastDailyLogin || null,
      lastCheckIn: user.lastCheckIn || null, selectedBadge: user.selectedBadge || null,
      avatarFrame: user.avatarFrame || null, cardBackground: user.cardBackground || null,
      sakuraCoins: user.sakuraCoins || 0, expConverted: user.expConverted || 0,
      themeColor: user.themeColor || null, themeMode: user.themeMode || null,
      sakuraEnabled: user.sakuraEnabled !== false, discoverable: user.discoverable !== false,
      createdAt: date(user.createdAt, now), updatedAt: now,
    }));
    await client.insert(users).values(userRows).onConflictDoUpdate({
      target: users.id,
      set: {
        username: users.username, email: users.email, emailVerifiedAt: users.emailVerifiedAt,
        passwordHash: users.passwordHash, nickname: users.nickname, avatar: users.avatar,
        role: users.role, status: users.status, exp: users.exp, badges: users.badges,
        title: users.title, lastLoginAt: users.lastLoginAt, lastLoginIp: users.lastLoginIp,
        lastDailyLogin: users.lastDailyLogin, lastCheckIn: users.lastCheckIn,
        selectedBadge: users.selectedBadge, avatarFrame: users.avatarFrame,
        cardBackground: users.cardBackground, sakuraCoins: users.sakuraCoins,
        expConverted: users.expConverted, themeColor: users.themeColor, themeMode: users.themeMode,
        sakuraEnabled: users.sakuraEnabled, discoverable: users.discoverable, updatedAt: now,
      },
    });
  }

  await client.delete(commentLikes);
  await client.delete(feedbackStatusHistory);
  await client.delete(guideStatusHistory);
  await client.delete(gameImages);
  await client.delete(guideImages);
  await client.delete(resourceImages);
  await client.delete(feedbackImages);
  await client.delete(noticeHistory);
  await client.delete(inventory);
  await client.delete(coinTransactions);
  await client.delete(loginLogs);
  await client.delete(directMessages);
  await client.delete(friendships);
  await client.delete(notifications);
  await client.delete(contributors);
  await client.delete(photos);
  await client.delete(collections);
  await client.delete(comments);
  await client.delete(resources);
  await client.delete(guides);
  await client.delete(feedback);
  await client.delete(notices);
  await client.delete(gameUpdates);
  await client.delete(gameFiles);
  await client.delete(games);
  await client.delete(shopProducts);
  await client.delete(siteSettings);

  const allGuides = new Map<string, Guide>();
  for (const guide of data.guides) allGuides.set(guide.id, guide);
  for (const game of data.games) for (const guide of game.guides || []) allGuides.set(guide.id, guide);

  if (data.games.length) await client.insert(games).values(data.games.map((game) => ({
    id: game.id, name: game.name, slug: game.slug, cover: game.cover || "",
    genre: game.genre || "", platforms: game.platforms || [], status: game.status,
    latestVersion: game.latestVersion || "", updatedAt: date(game.updatedAt, now),
    description: game.description || "", tags: game.tags || [], views: game.views || 0,
    favorites: game.favorites || 0, minimumConfig: game.config?.minimum || null,
    recommendedConfig: game.config?.recommended || null,
  })));
  for (const game of data.games) {
    if (game.images?.length) await client.insert(gameImages).values(game.images.map((url, sortOrder) => ({ gameId: game.id, url, sortOrder })));
    if (game.updates?.length) await client.insert(gameUpdates).values(game.updates.map((item) => ({
      id: item.id, gameId: game.id, contributorId: item.contributorId || null,
      contributorName: item.contributorName || null, date: item.date, version: item.version,
      title: item.title, notes: item.notes || "",
    })));
    if (game.files?.length) await client.insert(gameFiles).values(game.files.map((item) => ({
      id: item.id, gameId: game.id, name: item.name, version: item.version, size: item.size,
      checksum: item.checksum, date: item.date, notes: item.notes || "", url: item.url || null,
    })));
  }

  const guideRowsData = [...allGuides.values()];
  if (guideRowsData.length) await client.insert(guides).values(guideRowsData.map((guide) => ({
    id: guide.id, userId: guide.userId || null, author: guide.author || null,
    gameId: guide.gameId || null, gameName: guide.gameName || null,
    title: guide.title, category: guide.category, tags: guide.tags || [], date: guide.date,
    content: guide.content, cover: guide.cover || null, bodyImage: guide.bodyImage || null,
    status: guide.status || "pending", updatedAt: guide.updatedAt ? date(guide.updatedAt) : null,
    views: guide.views || 0, favorites: guide.favorites || 0, rewardGranted: guide.rewardGranted || false,
  })));
  for (const guide of guideRowsData) {
    if (guide.bodyImages?.length) await client.insert(guideImages).values(guide.bodyImages.map((url, sortOrder) => ({ guideId: guide.id, url, sortOrder })));
    if (guide.statusHistory?.length) await client.insert(guideStatusHistory).values(guide.statusHistory.map((item) => ({
      guideId: guide.id, status: item.status, reply: item.reply || "", at: date(item.at, now), by: item.by,
    })));
  }

  if (data.resources.length) await client.insert(resources).values(data.resources.map((item) => ({
    id: item.id, userId: item.userId || null, username: item.username || null,
    title: item.title, cover: item.cover || "", gameId: item.gameId, gameName: item.gameName,
    version: item.version, description: item.description, scope: item.scope, install: item.install,
    url: item.url, tutorial: item.tutorial, tags: item.tags || [], updatedAt: date(item.updatedAt, now),
    views: item.views || 0, favorites: item.favorites || 0,
  })));
  for (const item of data.resources) if (item.images?.length) {
    await client.insert(resourceImages).values(item.images.map((url, sortOrder) => ({ resourceId: item.id, url, sortOrder })));
  }

  if (data.feedback.length) await client.insert(feedback).values(data.feedback.map((item) => ({
    id: item.id, userId: item.userId, username: item.username, title: item.title, type: item.type,
    gameId: item.gameId || "", description: item.description, image: item.image || "",
    status: item.status || "pending", reply: item.reply || "", createdAt: date(item.createdAt, now),
    bugSeverity: item.bugSeverity || null, rewardGranted: item.rewardGranted || false,
  })));
  for (const item of data.feedback) {
    if (item.images?.length) await client.insert(feedbackImages).values(item.images.map((url, sortOrder) => ({ feedbackId: item.id, url, sortOrder })));
    if (item.statusHistory?.length) await client.insert(feedbackStatusHistory).values(item.statusHistory.map((entry) => ({
      feedbackId: item.id, status: entry.status, reply: entry.reply || "", at: date(entry.at, now), by: entry.by,
    })));
  }

  if (data.notices.length) await client.insert(notices).values(data.notices.map((item) => ({
    id: item.id, title: item.title, subtitle: item.subtitle || "", cover: item.cover || "",
    content: item.content, date: item.date, pinned: item.pinned || false,
    published: item.published || false, updatedBy: item.updatedBy || "system",
    updatedById: item.updatedById || null, updatedAt: item.updatedAt ? date(item.updatedAt) : null,
  })));
  for (const item of data.notices) if (item.history?.length) {
    await client.insert(noticeHistory).values(item.history.map((entry) => ({
      id: entry.id, noticeId: item.id, date: entry.date, content: entry.content,
      title: entry.title, subtitle: entry.subtitle, cover: entry.cover || "",
    })));
  }

  if (data.collections.length) await client.insert(collections).values(data.collections.map((item) => ({
    id: item.id, userId: item.userId, targetType: item.targetType, targetId: item.targetId,
    createdAt: date(item.createdAt, now),
  })));
  if (data.comments.length) await client.insert(comments).values(data.comments.map((item) => ({
    id: item.id, targetType: item.targetType, targetId: item.targetId, userId: item.userId,
    content: item.content, createdAt: date(item.createdAt, now),
    updatedAt: item.updatedAt ? date(item.updatedAt) : null, parentId: item.parentId || null,
    pinned: item.pinned || false, deleted: item.deleted || false,
  })));
  for (const item of data.comments) if (item.likes?.length) {
    await client.insert(commentLikes).values(item.likes.map((userId) => ({ commentId: item.id, userId })));
  }
  if (data.photos.length) await client.insert(photos).values(data.photos.map((item) => ({
    id: item.id, userId: item.userId || null, username: item.username || null,
    title: item.title, description: item.description, image: item.image,
    createdAt: date(item.createdAt, now), downloads: item.downloads || 0, tags: item.tags || [],
  })));

  const products = data.shopProducts || createDefaultShopProducts();
  if (products.length) await client.insert(shopProducts).values(products.map((item) => ({
    id: item.id, name: item.name, description: item.description, image: item.image || "",
    category: item.category, price: item.price, active: item.active, stock: item.stock,
    effectValue: item.effectValue || null, createdAt: date(item.createdAt, now),
    updatedAt: date(item.updatedAt, now),
  })));
  if (data.inventory?.length) await client.insert(inventory).values(data.inventory.map((item) => ({
    id: item.id, userId: item.userId, productId: item.productId, productName: item.productName,
    category: item.category, purchasedAt: date(item.purchasedAt, now), price: item.price,
  })));
  if (data.coinTransactions?.length) await client.insert(coinTransactions).values(data.coinTransactions.map((item) => ({
    id: item.id, userId: item.userId, type: item.type, amount: item.amount,
    balanceBefore: item.balanceBefore, balanceAfter: item.balanceAfter,
    description: item.description, createdAt: date(item.createdAt, now), relatedId: item.relatedId || null,
  })));
  if (data.loginLogs.length) await client.insert(loginLogs).values(data.loginLogs.map((item) => ({
    id: item.id, userId: item.userId, username: item.username, ip: item.ip, date: date(item.date, now),
  })));
  if (data.messages?.length) await client.insert(directMessages).values(data.messages.map((item) => ({
    id: item.id, fromId: item.fromId, toId: item.toId, content: item.content,
    createdAt: date(item.createdAt, now), readAt: item.readAt ? date(item.readAt) : null,
  })));
  if (data.friendships?.length) await client.insert(friendships).values(data.friendships.map((item) => ({
    id: item.id, requesterId: item.requesterId, addresseeId: item.addresseeId,
    status: item.status, createdAt: date(item.createdAt, now), updatedAt: date(item.updatedAt, now),
  })));
  if (data.notifications?.length) await client.insert(notifications).values(data.notifications.map((item) => ({
    id: item.id, userId: item.userId, type: item.type, title: item.title, body: item.body,
    href: item.href, createdAt: date(item.createdAt, now), readAt: item.readAt ? date(item.readAt) : null,
    actorId: item.actorId || null,
  })));
  if (data.contributors?.length) await client.insert(contributors).values(data.contributors.map((item) => ({
    id: item.id, name: item.name, role: item.role, description: item.description, kind: item.kind,
    userId: item.userId || null, avatar: item.avatar || null, exp: item.exp || 0,
    badges: item.badges || [], createdAt: date(item.createdAt, now),
  })));
  const settingEntries = Object.entries(data.siteSettings || {});
  if (settingEntries.length) await client.insert(siteSettings).values(settingEntries.map(([key, value]) => ({
    key, value: JSON.stringify(value) ?? "null", updatedAt: now,
  })));
}

export const readDb = cache(async function readDb(): Promise<Database> {
  const revision = await ensureRevision(db);
  const data = await loadSnapshot(db);
  readVersions.set(data, revision);
  return data;
});

export async function writeDb(data: Database): Promise<void> {
  const expected = readVersions.get(data);
  if (expected === undefined) throw new Error("数据库写入缺少原始版本信息，请重新读取后再试。");
  await db.transaction(async (transaction) => {
    const client = transaction as unknown as Executor;
    const rows = await client.update(appRevisions)
      .set({ revision: expected + 1, updatedAt: new Date() })
      .where(and(eq(appRevisions.id, "main"), eq(appRevisions.revision, expected)))
      .returning({ revision: appRevisions.revision });
    if (!rows.length) throw new Error("数据库刚刚被其他请求修改。为避免覆盖新数据，本次操作未保存，请刷新后重试。");
    await persistSnapshot(client, data);
  });
  readVersions.set(data, expected + 1);
}

export async function getGameBySlug(slug: string) {
  return (await readDb()).games.find((game) => game.slug === slug);
}

export async function mutateDb<T>(mutator: (data: Database) => T | Promise<T>): Promise<T> {
  return db.transaction(async (transaction) => {
    const client = transaction as unknown as Executor;
    const revision = await ensureRevision(client);
    const [locked] = await client.select({ revision: appRevisions.revision })
      .from(appRevisions).where(eq(appRevisions.id, "main")).for("update").limit(1);
    const data = await loadSnapshot(client);
    const result = await mutator(data);
    await client.update(appRevisions)
      .set({ revision: Number(locked?.revision ?? revision) + 1, updatedAt: new Date() })
      .where(eq(appRevisions.id, "main"));
    await persistSnapshot(client, data);
    return result;
  });
}
