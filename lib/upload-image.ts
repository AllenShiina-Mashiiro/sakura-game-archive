'use client';

import { createClient } from '@supabase/supabase-js';

type UploadGrant = {
  bucket: string;
  path: string;
  token: string;
  url: string;
  supabaseUrl: string;
  publishableKey: string;
};

/**
 * Requests a short-lived, single-object upload grant from our authenticated
 * server, then sends the file directly to Supabase Storage. The file bytes
 * never pass through a Next.js / Netlify Function.
 */
export async function uploadImageDirect(file: File, folder: string): Promise<string> {
  const response = await fetch('/api/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folder,
      contentType: file.type,
      size: file.size,
    }),
  });
  const grantData = await response.json();
  if (!response.ok) {
    throw new Error(grantData.error || '无法创建图片上传任务');
  }

  const grant = grantData as UploadGrant;
  const supabase = createClient(grant.supabaseUrl, grant.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.storage
    .from(grant.bucket)
    .uploadToSignedUrl(grant.path, grant.token, file, {
      contentType: file.type,
      cacheControl: '3600',
    });

  if (error) {
    console.error('Supabase 直传失败:', error.message);
    throw new Error('图片上传失败，请检查网络后重试');
  }

  return grant.url;
}
