import type { Metadata } from 'next';
import './globals.css';
import { getSessionUser } from '@/lib/auth';
import { readDb } from '@/lib/db';
import { ThemeEffects } from './components/ThemeEffects';
export const metadata: Metadata = {
  title: 'Game Archive · AllenShiina的游戏档案库',
  description: '游戏档案、教程、拓展资源与玩家交流社区',
};
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, db] = await Promise.all([getSessionUser(), readDb()]);
  const settings = db.siteSettings || {};
  return (
    <html lang="zh-CN">
      <body
        style={
          {
            '--page-overlay': String(1 - (settings.backgroundOpacity ?? 72) / 100),
            '--panel-alpha': `${settings.panelOpacity ?? 88}%`,
            '--card-alpha': `${settings.cardOpacity ?? 90}%`,
            '--nav-alpha': `${settings.navOpacity ?? 92}%`,
            '--popup-alpha': `${settings.popupOpacity ?? 94}%`,
          } as unknown as React.CSSProperties
        }
      >
        <ThemeEffects initialMode={user?.themeMode || settings.defaultThemeMode || 'dark'} initialColor={user?.themeColor || settings.defaultThemeColor || '#ec8eb8'} initialPetals={user?.sakuraEnabled ?? settings.sakuraEnabled ?? true} />
        {children}
      </body>
    </html>
  );
}
