import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const USER_FOLDERS = [
  'content',
  'tutorials',
  'feedback',
  'profile-cards',
  'avatars',
];

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

// A publishable key is designed for public clients. Keep it separate from the
// server-only service role key; deployments may override it through env.
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_dXqRhoNmTwYbs_5QGSLSGw_HVFu8_w9';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const folder = String(body.folder || 'content')
      .replace(/[^a-z0-9_-]/gi, '')
      .slice(0, 24) || 'content';
    const contentType = String(body.contentType || '');
    const ext = MIME_EXT[contentType];
    const size = Number(body.size);

    if (!ext) {
      return NextResponse.json(
        { error: '仅支持 JPG、PNG、WEBP、GIF 图片' },
        { status: 400 },
      );
    }

    if (!Number.isSafeInteger(size) || size <= 0) {
      return NextResponse.json({ error: '图片文件信息无效' }, { status: 400 });
    }

    const isUserFolder = USER_FOLDERS.includes(folder);
    const isAdminFolder = ADMIN_FOLDERS.includes(folder);
    if (!isUserFolder && !isAdminFolder) {
      return NextResponse.json({ error: '不允许上传到该目录' }, { status: 400 });
    }
    if (isAdminFolder && user.role !== 'admin') {
      return NextResponse.json(
        { error: '该上传目录仅管理员可用' },
        { status: 403 },
      );
    }

    // These checks improve feedback; bucket-level limits are the authoritative
    // server-side enforcement and cannot be bypassed by changing this request.
    const maxBytes = folder === 'avatars'
      ? 4 * 1024 * 1024
      : folder === 'photos'
        ? 50 * 1024 * 1024
        : 12 * 1024 * 1024;
    if (size > maxBytes) {
      return NextResponse.json(
        { error: `图片不能超过 ${maxBytes / 1024 / 1024} MB` },
        { status: 400 },
      );
    }

    const bucket = folder === 'avatars'
      ? 'avatars'
      : folder === 'photos'
        ? 'photos'
        : 'content';
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    const path = folder === 'avatars'
      ? `${user.id}/${filename}`
      : `${folder}/${filename}`;

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data?.token) {
      console.error('创建 Supabase 签名上传地址失败:', error?.message);
      return NextResponse.json(
        { error: '无法创建图片上传任务，请稍后重试' },
        { status: 500 },
      );
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path);
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      DEFAULT_PUBLISHABLE_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase URL 未配置' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      bucket,
      path,
      token: data.token,
      url: publicData.publicUrl,
      supabaseUrl,
      publishableKey,
    });
  } catch (error) {
    console.error('创建图片上传任务异常:', error);
    return NextResponse.json(
      { error: '无法创建图片上传任务，请稍后重试' },
      { status: 500 },
    );
  }
}
