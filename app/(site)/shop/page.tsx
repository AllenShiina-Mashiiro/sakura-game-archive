import { getSessionUser } from '@/lib/auth';
import { readDb } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ShopClient } from '@/app/components/ShopClient';
export const dynamic = 'force-dynamic';
export default async function ShopPage() {
  const user = await getSessionUser(); if (!user) redirect('/login');
  const db = await readDb();
  const products = (db.shopProducts || []).filter((p) => p.active && p.category !== 'vip');
  return <div className="page-wrap">
    <header className="topbar"><div><div className="eyebrow">SAKURA MARKET</div><h1>樱花商店</h1><p className="subtitle">把社区贡献转化为装饰与收藏。经验不会因兑换而减少。</p></div></header>
    <ShopClient exp={user.exp || 0} expConverted={user.expConverted || 0} coins={user.sakuraCoins || 0} products={products} />
  </div>;
}
