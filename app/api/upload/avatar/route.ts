
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function POST(req: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const file = form.get('avatar');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '请选择头像图片' }, { status: 400 });
    }

    const ext = MIME_EXT[file.type];

    if (!ext) {
      return NextResponse.json(
        { error: '仅支持 JPG、PNG、WEBP 或 GIF 图片' },
        { status: 400 }
      );
    }

    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: '头像不能超过 4 MB' },
        { status: 400 }
      );
    }

    const filename = `${user.id}-${randomUUID()}.${ext}`;
    const storagePath = `avatars/${filename}`;

    const { error } = await supabaseAdmin.storage
      .from('uploads')
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Supabase 头像上传失败:', error.message);
      return NextResponse.json({ error: '头像上传失败' }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error('头像上传异常:', error);
    return NextResponse.json({ error: '头像上传失败' }, { status: 500 });
  }
}
