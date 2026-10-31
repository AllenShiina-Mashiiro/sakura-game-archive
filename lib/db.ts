import 'server-only';
import type { Database, Game } from './types';
import { getSupabaseAdmin } from './supabase-admin';

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
  shopProducts: [],
  inventory: [],
  coinTransactions: [],
  messages: [],
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

export async function readDb(): Promise<Database> {
  const row = await getRow();
  return normalizeDb(row.data);
}

let queue: Promise<unknown> = Promise.resolve();

export async function writeDb(db: Database): Promise<void> {
  const run = async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const row = await getRow();
      const saved = await saveWithVersion(db, row.version);

      if (saved) return;
    }

    throw new Error('数据库正在被频繁修改，请稍后重试。');
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