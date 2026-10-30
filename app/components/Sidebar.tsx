'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { SocialIndicators } from './SocialIndicators';

export function Sidebar({ user, logo }: { user: User; logo?: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const links = [
    ['/', '⌂', '主页'],
    ['/games', '◈', '游戏档案'],
    ['/tutorials', '▤', '教程中心'],
    ['/resources', '⌘', '拓展资源'],
    ['/notices', '▣', '公告牌'],
    ['/photos', '▧', '照片墙'],
    ['/feedback', '✉', '问题反馈'],
    ['/favorites', '♡', '个人收藏'],
    ['/contributors', '✿', '贡献者'],
  ] as const;
  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className={`sidebar ${pinned ? 'is-pinned' : ''}`} onMouseEnter={() => {}}>
      <button type="button" className="sidebar-pin-toggle" aria-label={pinned ? '收起侧边栏' : '固定展开侧边栏'} title={pinned ? '取消固定' : '固定侧边栏'} onClick={() => setPinned((v) => !v)}>
        {pinned ? '‹' : '›'}
      </button>
      <Link className="brand" href="/">
        {logo ? (
          <span className="brand-mark brand-image">
            <img src={logo} alt="网站 Logo" />
          </span>
        ) : (
          <span className="brand-mark">G</span>
        )}
        <span>
          <strong>GAME ARCHIVE</strong>
          <small>AllenShiina的游戏档案库</small>
        </span>
      </Link>
      <div className="nav-label">内容探索</div>
      <nav className="nav-list">
        {links.map(([href, icon, label]) => (
          <Link href={href} className="nav-link" key={href}>
            <span>{icon}</span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-social">
        <SocialIndicators />
      </div>
      <div className="sidebar-bottom">
        {open && (
          <div className="account-menu" data-theme-surface="true">
            <div className="account-menu-head">
              <span className={`avatar avatar-frame-${user.avatarFrame || 'none'}`}>{user.avatar ? <img src={user.avatar} alt="" /> : user.nickname.slice(0, 1)}</span>
              <div>
                <b>{user.nickname}</b>
                <small>
                  Lv.{level(user.exp)} · {roleName(user.role)}
                </small>
              </div>
            </div>
            <Link href="/profile" onClick={() => setOpen(false)}>
              账号信息 / 修改资料
            </Link>
            <Link href="/favorites" onClick={() => setOpen(false)}>
              我的收藏
            </Link>
            <Link href="/messages" onClick={() => setOpen(false)}>
              私信
            </Link>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              通知中心
            </Link>
            <Link href="/contributors" onClick={() => setOpen(false)}>
              贡献者
            </Link>
            {user.role === 'admin' && (
              <Link href="/admin" onClick={() => setOpen(false)}>
                管理后台
              </Link>
            )}
            <button type="button" onClick={logout} disabled={busy}>
              {busy ? '正在退出…' : '退出当前账号'}
            </button>
          </div>
        )}
        <button type="button" className="profile-mini profile-menu-trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className={`avatar avatar-frame-${user.avatarFrame || 'none'}`}>{user.avatar ? <img src={user.avatar} alt="" /> : user.nickname.slice(0, 1)}</span>
          <span>
            <b>{user.nickname}</b>
            <small>
              Lv.{level(user.exp)} · {roleName(user.role)}
            </small>
          </span>
          <i>{open ? '⌄' : '⌃'}</i>
        </button>
        <p>资料与交流 · 本地 JSON 存储</p>
      </div>
    </aside>
  );
}
function level(exp: number) {
  let lv = 1;
  for (const [n, need] of [
    [2, 50],
    [3, 120],
    [4, 220],
    [5, 350],
    [10, 900],
    [15, 1800],
    [20, 3000],
    [25, 4600],
    [30, 6500],
  ] as number[][])
    if (exp >= need) lv = n;
  return lv;
}
function roleName(r: string) {
  return r === 'admin' ? '管理员' : r === 'vip' ? 'VIP会员' : '普通用户';
}
