import { readDb } from '@/lib/db';
import Link from 'next/link';
import { AuthForm } from '../components/AuthForm';
export const dynamic = 'force-dynamic';
export default async function Login() {
  const db = await readDb();
  const bg = db.siteSettings?.background;
  return (
    <div className="auth-page" style={bg ? { backgroundImage: `url("${bg}")` } : undefined}>
      <div className="auth-card">
        <Link href="/" className="brand">
          {db.siteSettings?.logo ? (
            <span className="brand-mark brand-image">
              <img src={db.siteSettings.logo} alt="网站 Logo" />
            </span>
          ) : (
            <span className="brand-mark">G</span>
          )}
          <span>
            <strong>GAME ARCHIVE</strong>
            <small>AllenShiina的游戏档案库</small>
          </span>
        </Link>
        <div className="eyebrow">WELCOME BACK</div>
        <h1>登录账户</h1>
        <p>登录后访问游戏档案与社区内容。</p>
        <AuthForm mode="login" />
        <div className="auth-switch">
          还没有账户？ <Link href="/register">立即注册</Link>
        </div>
      </div>
    </div>
  );
}
