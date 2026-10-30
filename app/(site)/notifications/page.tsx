import { NotificationsClient } from '../../components/NotificationsClient';
export const dynamic = 'force-dynamic';
export default function NotificationsPage() {
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">NOTIFICATION CENTER</div>
          <h1>通知中心</h1>
          <p className="subtitle">集中查看互动、反馈、徽章、等级和系统通知。</p>
        </div>
      </header>
      <NotificationsClient />
    </div>
  );
}
