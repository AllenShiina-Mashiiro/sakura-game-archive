import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';

export const runtime = 'nodejs';
const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('avatar');
    if (!(file instanceof File)) return NextResponse.json({ error: '请选择头像图片' }, { status: 400 });
    const ext = MIME_EXT[file.type];
    if (!ext) return NextResponse.json({ error: '仅支持 JPG、PNG、WEBP 或 GIF 图片' }, { status: 400 });
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: '头像不能超过 2 MB' }, { status: 400 });
    const dir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    await mkdir(dir, { recursive: true });
    const filename = `${user.id}-${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url: `/uploads/avatars/${filename}` });
  } catch {
    return NextResponse.json({ error: '头像上传失败' }, { status: 500 });
  }
}
