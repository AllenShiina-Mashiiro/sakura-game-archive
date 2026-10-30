import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
export const runtime = 'nodejs';
const types: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
  try {
    const fd = await req.formData();
    const file = fd.get('image');
    if (!(file instanceof File)) return NextResponse.json({ error: '请选择图片' }, { status: 400 });
    const ext = types[file.type];
    if (!ext) return NextResponse.json({ error: '仅支持 JPG、PNG、WEBP、GIF' }, { status: 400 });
    const folder =
      String(fd.get('folder') || 'content')
        .replace(/[^a-z0-9_-]/gi, '')
        .slice(0, 24) || 'content';
    if (['photos', 'contributors', 'branding', 'backgrounds', 'shop'].includes(folder) && user.role !== 'admin') return NextResponse.json({ error: '该上传目录仅管理员可用' }, { status: 403 });
    const maxBytes = folder === 'photos' ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) return NextResponse.json({ error: folder === 'photos' ? '照片墙原图不能超过 50 MB' : '图片不能超过 8 MB' }, { status: 400 });
    const dir = path.join(process.cwd(), 'public', 'uploads', folder);
    await mkdir(dir, { recursive: true });
    const name = `${Date.now()}-${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url: `/uploads/${folder}/${name}` });
  } catch {
    return NextResponse.json({ error: '图片上传失败' }, { status: 500 });
  }
}
