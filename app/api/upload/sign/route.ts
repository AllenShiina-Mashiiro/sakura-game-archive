import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveImageUploadPolicy } from '@/lib/upload-policy.mjs';
import { buildTusUploadEndpoint } from '@/lib/tus-upload.mjs';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const policy = resolveImageUploadPolicy({
      folder: body.folder,
      role: user.role,
      contentType: body.contentType,
      size: Number(body.size),
    });
    if (!policy.ok) {
      return NextResponse.json(
        { error: policy.error },
        { status: policy.status },
      );
    }

    const { folder, bucket, extension } = policy;
    const filename = `${Date.now()}-${randomUUID()}.${extension}`;
    const path = folder === 'avatars'
      ? `${user.id}/${filename}`
      : `${folder}/${filename}`;

    const supabaseAdmin = getSupabaseAdmin();
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
      return NextResponse.json({ error: '请配置 SUPABASE_URL 和当前项目的 SUPABASE_PUBLISHABLE_KEY' }, { status: 500 });
    }

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
    const resumableEndpoint = buildTusUploadEndpoint(supabaseUrl);

    return NextResponse.json({
      bucket,
      path,
      token: data.token,
      url: publicData.publicUrl,
      supabaseUrl,
      resumableEndpoint,
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
