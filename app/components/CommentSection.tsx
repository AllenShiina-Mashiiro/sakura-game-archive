import { readDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { Comments } from './Comments';
export async function CommentSection({ targetType, targetId }: { targetType: 'game' | 'guide' | 'resource'; targetId: string }) {
  const [db, user] = await Promise.all([readDb(), getSessionUser()]);
  const items = db.comments
    .filter((c) => !c.deleted && c.targetType === targetType && c.targetId === targetId)
    .map((c) => {
      const u = db.users.find((x) => x.id === c.userId);
      return {
        ...c,
        nickname: u?.nickname || '已注销用户',
        avatar: u?.avatar || '',
        level: Math.max(1, Math.floor(Math.sqrt((u?.exp || 0) / 40)) + 1),
        badges: u?.badges || [],
        avatarFrame: u?.avatarFrame || 'none',
      };
    });
  return <Comments targetType={targetType} targetId={targetId} items={items} me={user?.id || ''} admin={user?.role === 'admin'} />;
}
