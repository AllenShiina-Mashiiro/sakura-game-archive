
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const types: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// 普通用户允许上传的目录
const USER_FOLDERS = [
  'content',
  'tutorials',
  'feedback',
  'profile-cards',
];

// 仅管理员允许上传的目录
const ADMIN_FOLDERS = [
  'games',
  'resources',
  'notices',
  'photos',
  'contributors',
  'branding',
  'backgrounds',
  'shop',
];

export async function POST(req: Request) {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { error: '请先登录' },
      { status: 401 }
    );
  }

  try {
    const fd = await req.formData();
    const file = fd.get('image');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: '请选择图片' },
        { status: 400 }
      );
    }

    const ext = types[file.type];

    if (!ext) {
      return NextResponse.json(
        { error: '仅支持 JPG、PNG、WEBP、GIF' },
        { status: 400 }
      );
    }

    const folder = String(fd.get('folder') || 'content')
      .replace(/[^a-z0-9_-]/gi, '')
      .slice(0, 24) || 'content';

    // 检查上传目录是否合法
    const isUserFolder = USER_FOLDERS.includes(folder);
    const isAdminFolder = ADMIN_FOLDERS.includes(folder);

    if (!isUserFolder && !isAdminFolder) {
      return NextResponse.json(
        { error: '不允许上传到该目录' },
        { status: 400 }
      );
    }

    // 管理员专属目录必须验证管理员身份
    if (isAdminFolder && user.role !== 'admin') {
      return NextResponse.json(
        { error: '该上传目录仅管理员可用' },
        { status: 403 }
      );
    }

    // 限制文件大小
    const maxBytes =
      folder === 'photos'
        ? 50 * 1024 * 1024
        : 12 * 1024 * 1024;

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error:
            folder === 'photos'
              ? '照片墙原图不能超过 50 MB'
              : '图片不能超过 12 MB',
        },
        { status: 400 }
      );
    }

    const name = `${Date.now()}-${randomUUID()}.${ext}`;
    const storagePath = `${folder}/${name}`;

    const { error } = await supabaseAdmin.storage
      .from('uploads')
      .upload(
        storagePath,
        Buffer.from(await file.arrayBuffer()),
        {
          contentType: file.type,
          upsert: false,
        }
      );

    if (error) {
      console.error('Supabase 图片上传失败:', error.message);
      return NextResponse.json(
        { error: '图片上传失败' },
        { status: 500 }
      );
    }

    const { data } = supabaseAdmin.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      url: data.publicUrl,
    });
  } catch (error) {
    console.error('图片上传异常:', error);
    return NextResponse.json(
      { error: '图片上传失败' },
      { status: 500 }
    );
  }
}
