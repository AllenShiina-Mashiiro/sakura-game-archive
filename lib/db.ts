import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import type { Database, Game, ShopProduct } from "./types";
import { db } from "./postgres";
import { appState } from "@/drizzle/schema";

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

function normalizeDb(raw: Partial<Database> | null | undefined): Database {
  const defaults = empty();
  return {
    ...defaults,
    ...raw,
    users: (raw?.users || []).map((u) => ({
      ...u,
      sakuraCoins: Math.max(0, Number(u.sakuraCoins) || 0),
      expConverted: Math.max(0, Number(u.expConverted) || 0),
    })),
    shopProducts: raw?.shopProducts ?? defaults.shopProducts,
    inventory: raw?.inventory || [],
    coinTransactions: raw?.coinTransactions || [],
    messages: raw?.messages || [],
    friendships: raw?.friendships || [],
    notifications: raw?.notifications || [],
    contributors: raw?.contributors || [],
    games: (raw?.games ?? []).map((g) => ({
      ...g, views: g.views || 0, favorites: g.favorites || 0,
      updates: g.updates || [], files: g.files || [], guides: g.guides || [],
    })),
    comments: raw?.comments || [],
    photos: raw?.photos || [],
    siteSettings: raw?.siteSettings || {},
  };
}

type DbRow = { data: Partial<Database>; version: number };

async function getRow(): Promise<DbRow> {
  let [row] = await db.select({ data: appState.data, version: appState.version })
    .from(appState).where(eq(appState.id, "main")).limit(1);
  if (!row) {
    const initial = empty();
    await db.insert(appState).values({ id: "main", data: initial, version: 1 }).onConflictDoNothing();
    [row] = await db.select({ data: appState.data, version: appState.version })
      .from(appState).where(eq(appState.id, "main")).limit(1);
  }
  if (!row) throw new Error("初始化本地 PostgreSQL app_state 失败");
  return { data: row.data, version: Number(row.version) };
}

async function saveWithVersion(nextDb: Database, expectedVersion: number): Promise<boolean> {
  const rows = await db.update(appState)
    .set({ data: nextDb, version: expectedVersion + 1, updatedAt: new Date() })
    .where(and(eq(appState.id, "main"), eq(appState.version, expectedVersion)))
    .returning({ id: appState.id });
  return rows.length > 0;
}

const readVersions = new WeakMap<Database, number>();

export const readDb = cache(async function readDb(): Promise<Database> {
  const row = await getRow();
  const data = normalizeDb(row.data);
  readVersions.set(data, row.version);
  return data;
});

let queue: Promise<unknown> = Promise.resolve();

export async function writeDb(data: Database): Promise<void> {
  const run = async () => {
    const expectedVersion = readVersions.get(data);
    if (expectedVersion === undefined) throw new Error("数据库写入缺少原始版本信息，请重新读取后再试。");
    const saved = await saveWithVersion(data, expectedVersion);
    if (!saved) throw new Error("数据库刚刚被其他请求修改。为避免覆盖新数据，本次操作未保存，请刷新后重试。");
    readVersions.set(data, expectedVersion + 1);
  };
  const next = queue.then(run, run);
  queue = next.then(() => undefined, () => undefined);
  await next;
}

export async function getGameBySlug(slug: string) {
  return (await readDb()).games.find((game) => game.slug === slug);
}

export async function mutateDb<T>(mutator: (data: Database) => T | Promise<T>): Promise<T> {
  const run = async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const row = await getRow();
      const data = normalizeDb(row.data);
      const result = await mutator(data);
      if (await saveWithVersion(data, row.version)) return result;
    }
    throw new Error("数据库正在被频繁修改，请稍后重试。");
  };
  const next = queue.then(run, run);
  queue = next.then(() => undefined, () => undefined);
  return (await next) as T;
}
