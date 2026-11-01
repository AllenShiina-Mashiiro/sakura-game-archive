import 'server-only';
import type { Database, Game, ShopProduct } from './types';
import { getSupabaseAdmin } from './supabase-admin';

export function createDefaultShopProducts(): ShopProduct[] {
  const now = new Date().toISOString();
  return [
    { id: 'frame-sakura', name: '樱花头像框', description: '柔和的樱花主题头像装饰。', image: '', category: 'avatar-frame', price: 50, active: true, stock: null, effectValue: 'sakura', createdAt: now, updatedAt: now },
    { id: 'frame-gold', name: '鎏金头像框', description: '金色边框装饰。', image: '', category: 'avatar-frame', price: 100, active: true, stock: null, effectValue: 'gold', createdAt: now, updatedAt: now },
    { id: 'frame-glass', name: '星璃头像框', description: '玻璃质感头像装饰。', image: '', category: 'avatar-frame', price: 150, active: true, stock: null, effectValue: 'glass', createdAt: now, updatedAt: now },
  ];
}

const empty = (): Database => ({
  users: [],
  games: [],
  resources: [],
  guides: [],
  feedback: [],
  notices: [],
  collections: [],
  loginLogs: [],
  comments: [],
  photos: [],
  siteSettings: {},
  shopProducts: createDefaultShopProducts(),
  inventory: [],
  coinTransactions: [],
  messages: [],
  friendships: [],
  notifications: [],
  contributors: [],
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
      ...g,
      views: g.views || 0,
      favorites: g.favorites || 0,
      updates: g.updates || [],
      files: g.files || [],
      guides: g.guides || [],
    })),
    comments: raw?.comments || [],
    photos: raw?.photos || [],
    siteSettings: raw?.siteSettings || {},
  };
}

type DbRow = {
  data: Partial<Database>;
  version: number;
};

async function getRow(): Promise<DbRow> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('app_state')
    .select('data, version')
    .eq('id', 'main')
    .maybeSingle();

  if (error) {
    throw new Error(`读取 Supabase 数据库失败：${error.message}`);
  }

  if (data) {
    return {
      data: data.data as Partial<Database>,
      version: Number(data.version),
    };
  }

  // 数据记录不存在时初始化。若多个请求同时初始化，允许其中一个成功。
  const initial = empty();

  const { error: insertError } = await supabaseAdmin
    .from('app_state')
    .insert({
      id: 'main',
      data: initial,
      version: 1,
    });

  if (insertError) {
    // 可能是另一个请求抢先创建了记录，重新读取即可。
    const { data: retryData, error: retryError } = await supabaseAdmin
      .from('app_state')
      .select('data, version')
      .eq('id', 'main')
      .single();

    if (retryError || !retryData) {
      throw new Error(`初始化 Supabase 数据库失败：${insertError.message}`);
    }

    return {
      data: retryData.data as Partial<Database>,
      version: Number(retryData.version),
    };
  }

  return { data: initial, version: 1 };
}

async function saveWithVersion(
  db: Database,
  expectedVersion: number,
): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('app_state')
    .update({
      data: db,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'main')
    .eq('version', expectedVersion)
    .select('version')
    .maybeSingle();

  if (error) {
    throw new Error(`保存 Supabase 数据库失败：${error.message}`);
  }

  return Boolean(data);
}

const readVersions = new WeakMap<Database, number>();

export async function readDb(): Promise<Database> {
  const row = await getRow();
  const db = normalizeDb(row.data);
  readVersions.set(db, row.version);
  return db;
}

let queue: Promise<unknown> = Promise.resolve();

export async function writeDb(db: Database): Promise<void> {
  const run = async () => {
    const expectedVersion = readVersions.get(db);
    if (expectedVersion === undefined) {
      throw new Error('数据库写入缺少原始版本信息，请重新读取后再试。');
    }
    const saved = await saveWithVersion(db, expectedVersion);
    if (!saved) {
      throw new Error('数据库刚刚被其他请求修改。为避免覆盖新数据，本次操作未保存，请刷新后重试。');
    }
    readVersions.set(db, expectedVersion + 1);
  };

  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );

  await next;
}

export async function getGameBySlug(slug: string) {
  return (await readDb()).games.find((g) => g.slug === slug);
}

// 使用版本号进行乐观锁保护，避免多个服务器请求互相覆盖数据。
export async function mutateDb<T>(
  mutator: (db: Database) => T | Promise<T>,
): Promise<T> {
  const run = async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const row = await getRow();
      const db = normalizeDb(row.data);

      const result = await mutator(db);
      const saved = await saveWithVersion(db, row.version);

      if (saved) return result;
    }

    throw new Error('数据库正在被频繁修改，请稍后重试。');
  };

  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );

  return (await next) as T;
}
