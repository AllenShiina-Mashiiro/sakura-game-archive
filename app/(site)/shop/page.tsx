import { getSessionUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function ShopPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">SAKURA MARKET</div>
          <h1>商城暂未开放</h1>
          <p className="subtitle">商城商品展示与购买功能暂时隐藏，已有账户数据会保留。</p>
        </div>
      </header>
      <div className="empty-state">商城正在维护中，后续开放时会另行通知。你的樱花币与购买记录不会因本次隐藏而删除。</div>
    </div>
  );
}
