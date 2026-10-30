import { readDb } from '@/lib/db';
import Link from 'next/link';
import { AuthForm } from '../components/AuthForm';
export const dynamic = 'force-dynamic';
export default async function Register() {
  const db = await readDb();
  const bg = db.siteSettings?.background;
  return (
    <div
      className="auth-page"
      style={
        bg
          ? {
              backgroundImage: `linear-gradient(120deg,rgba(6,8,18,.76),rgba(10,12,24,.88)),url("${bg}")`,
            }
          : undefined
      }
    >
      <div className="auth-card">
        <Link href="/" className="brand">
          <span className="brand-mark">G</span>
          <span>
            <strong>GAME ARCHIVE</strong>
            <small>AllenShiina的游戏档案库</small>
          </span>
        </Link>
        <div className="eyebrow">JOIN THE ARCHIVE</div>
        <h1>创建账户</h1>
        <p>注册后即可收藏资料、发布教程和提交反馈。</p>
        <AuthForm mode="register" />
        <div className="auth-switch">
          已有账户？ <Link href="/login">返回登录</Link>
        </div>
      </div>
    </div>
  );
}
