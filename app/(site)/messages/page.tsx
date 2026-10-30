import { MessagesClient } from '../../components/MessagesClient';
export const dynamic = 'force-dynamic';
export default function MessagesPage() {
  return (
    <div className="page-wrap">
      <header className="topbar">
        <div>
          <div className="eyebrow">DIRECT MESSAGES</div>
          <h1>私信</h1>
          <p className="subtitle">与社区成员进行文字交流，点击头像即可查看对方主页。</p>
        </div>
      </header>
      <MessagesClient />
    </div>
  );
}
