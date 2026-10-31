import 'server-only';
import type { Database, Game } from './types';
import { getSupabaseAdmin } from './supabase-admin';

const seedGames: Game[] = [
  {
    id: 'seed-wuthering-waves',
    name: '鸣潮',
    slug: 'wuthering-waves',
    cover: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=85',
    genre: '开放世界 / 动作 RPG',
    platforms: ['PC', 'Android', 'iOS', 'PS5'],
    status: '运营中',
    latestVersion: '2.8.0',
    updatedAt: '2026-10-24',
    description: '开放世界动作角色扮演游戏资料档案。记录版本更新、资源文件、攻略笔记与开发者公告。',
    tags: ['开放世界', '动作', '二次元'],
    updates: [
      {
        id: 'u1',
        date: '2026-10-24',
        version: '2.8.0',
        title: '版本记录示例',
        notes: '演示数据，请按实际情况核实。',
      },
    ],
    files: [],
    guides: [],
    views: 0,
    favorites: 0,
  },
  {
    id: 'seed-genshin',
    name: '原神',
    slug: 'genshin-impact',
    cover: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=85',
    genre: '开放世界 / 动作 RPG',
    platforms: ['PC', 'Android', 'iOS', 'PS5'],
    status: '运营中',
    latestVersion: '待更新',
    updatedAt: '2026-10-20',
    description: '用于整理游戏版本历史、客户端资源变动与图文攻略的示例档案。',
    tags: ['开放世界', '探索'],
    updates: [],
    files: [],
    guides: [],
    views: 0,
    favorites: 0,
  },
  {
    id: 'seed-minecraft',
    name: 'Minecraft',
    slug: 'minecraft',
    cover: 'https://images.unsplash.com/photo-1607513746994-51f730a44832?auto=format&fit=crop&w=1200&q=85',
    genre: '沙盒 / 生存建造',
    platforms: ['PC', '主机', '移动端'],
    status: '运营中',
    latestVersion: '待更新',
    updatedAt: '2026-10-18',
    description: '记录版本、模组环境、资源包与存档相关资料。',
    tags: ['沙盒', '生存', '模组'],
    updates: [],
    files: [],
    guides: [],
    views: 0,
    favorites: 0,
  },
];

const empty = (): Database => ({
  users: [],
  games: seedGames,
  resources: [],
  guides: [],
  feedback: [],
  notices: [],
  collections: [],
  loginLogs: [],
  comments: [],
  photos: [],
  siteSettings: {},
  shopProducts: [
    { id: 'frame-sakura', name: '樱花头像框', description: '柔和的樱花主题头像装饰。', image: '', category: 'avatar-frame', price: 80, active: true, stock: null, effectValue: 'sakura', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'frame-gold', name: '鎏金头像框', description: '金色边框装饰。', image: '', category: 'avatar-frame', price: 160, active: true, stock: null, effectValue: 'gold', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'frame-glass', name: '星璃头像框', description: '玻璃质感头像装饰。', image: '', category: 'avatar-frame', price: 220, active: true, stock: null, effectValue: 'glass', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ],
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
    shopProducts: raw?.shopProducts?.length ? raw.shopProducts : defaults.shopProducts,
    inventory: raw?.inventory || [],
    coinTransactions: raw?.coinTransactions || [],
    messages: raw?.messages || [],
    notifications: raw?.notifications || [],
    contributors: raw?.contributors || [],
    games: (raw?.games || seedGames).map((g) => ({
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