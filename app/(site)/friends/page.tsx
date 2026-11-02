import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { FriendsClient } from '@/app/components/FriendsClient';

export const dynamic = 'force-dynamic';

export default async function FriendsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">COMMUNITY / FRIENDS</div>
          <h1>好友列表</h1>
          <p className="subtitle">管理好友关系、处理好友请求，并快速进入好友主页或私信。</p>
        </div>
        <Link className="outline-btn" href="/messages">打开私信 →</Link>
      </header>
      <FriendsClient />
    </div>
  );
}
