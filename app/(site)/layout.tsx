import { redirect } from 'next/navigation';
import { getSessionUser, bootstrapAdmin } from '@/lib/auth';
import { Sidebar } from '../components/Sidebar';
import { readDb } from '@/lib/db';
export const dynamic = 'force-dynamic';
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await bootstrapAdmin();
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const activeUser = user!;
  const db = await readDb();
  return (
    <div className="app-shell">
      <Sidebar user={activeUser} logo={db.siteSettings?.logo} />
      <main
        className="main-content"
        style={db.siteSettings?.background
          ? { backgroundImage: `linear-gradient(rgba(8, 10, 16, 0.42), rgba(8, 10, 16, 0.58)), url("${db.siteSettings.background}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
          : undefined}
      >{children}</main>
    </div>
  );
}
