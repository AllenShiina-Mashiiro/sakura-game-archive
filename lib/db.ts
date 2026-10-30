import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Database, Game } from './types';
const file = path.join(process.cwd(), 'data', 'db.json');
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
  shopProducts: [],
  inventory: [],
  coinTransactions: [],
  messages: [],
  notifications: [],
  contributors: [],
});
export async function readDb(): Promise<Database> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const raw = JSON.parse(await fs.readFile(file, 'utf8')) as Partial<Database>;
    return {
      ...empty(),
      ...raw,
      users: (raw.users || []).map((u) => ({
        ...u,
        sakuraCoins: u.sakuraCoins || 0,
        expConverted: u.expConverted || 0,
      })),
      shopProducts: raw.shopProducts || [],
      inventory: raw.inventory || [],
      coinTransactions: raw.coinTransactions || [],
      messages: raw.messages || [],
      notifications: raw.notifications || [],
      contributors: raw.contributors || [],
      games: (raw.games || seedGames).map((g) => ({
        ...g,
        views: g.views || 0,
        favorites: g.favorites || 0,
        updates: g.updates || [],
        files: g.files || [],
        guides: g.guides || [],
      })),
      comments: raw.comments || [],
      photos: raw.photos || [],
      siteSettings: raw.siteSettings || {},
    };
  } catch (e) {
    try {
      await fs.access(file);
      throw new Error('data/db.json 无法解析，数据库文件可能损坏。请先备份文件，不要覆盖。');
    } catch (err) {
      if (err instanceof Error && err.message.includes('无法解析')) throw err;
      const db = empty();
      await writeDb(db);
      return db;
    }
  }
}
let queue: Promise<unknown> = Promise.resolve();
export async function writeDb(db: Database) {
  const run = async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.' + randomUUID() + '.tmp';
    await fs.writeFile(temp, JSON.stringify(db, null, 2), 'utf8');
    await fs.rename(temp, file);
  };
  queue = queue.then(run, run);
  await queue;
}
export async function getGameBySlug(slug: string) {
  return (await readDb()).games.find((g) => g.slug === slug);
}

// Serialize read-modify-write operations so wallet and inventory changes cannot overwrite each other.
export async function mutateDb<T>(mutator: (db: Database) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const db = await readDb();
    const result = await mutator(db);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + '.' + randomUUID() + '.tmp';
    await fs.writeFile(temp, JSON.stringify(db, null, 2), 'utf8');
    await fs.rename(temp, file);
    return result;
  };
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return (await next) as T;
}
