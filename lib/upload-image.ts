'use client';

import { createClient } from '@supabase/supabase-js';
import {
  buildTusUploadEndpoint,
  encodeTusMetadata,
  nextTusChunkEnd,
  TUS_CHUNK_SIZE,
} from '@/lib/tus-upload.mjs';

type UploadGrant = {
  bucket: string;
  path: string;
  token: string;
  url: string;
  supabaseUrl: string;
  resumableEndpoint?: string;
  publishableKey: string;
};

type UploadProgress = (uploaded: number, total: number) => void;

function responseError(response: Response, fallback: string) {
  return response.text().then((message) => {
    const detail = message.trim().slice(0, 300);
    return new Error(detail || `${fallback}（HTTP ${response.status}）`);
  });
}

async function readTusOffset(uploadUrl: string, headers: Record<string, string>) {
  const response = await fetch(uploadUrl, {
    method: 'HEAD',
    headers: {
      ...headers,
      'Tus-Resumable': '1.0.0',
    },
    cache: 'no-store',
  });
  if (!response.ok) throw await responseError(response, '无法读取断点续传进度');
  const offset = Number(response.headers.get('Upload-Offset'));
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Supabase 返回了无效的上传进度');
  }
  return offset;
}

async function uploadResumable(
  file: File,
  grant: UploadGrant,
  onProgress?: UploadProgress,
) {
  const endpoint = grant.resumableEndpoint || buildTusUploadEndpoint(grant.supabaseUrl);
  const authHeaders = {
    apikey: grant.publishableKey,
    'x-signature': grant.token,
  };
  const metadata = encodeTusMetadata({
    bucketName: grant.bucket,
    objectName: grant.path,
    contentType: file.type,
    cacheControl: '3600',
  });

  const creation = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
    },
  });
  if (creation.status !== 201) {
    throw await responseError(creation, '无法创建断点续传任务');
  }

  const location = creation.headers.get('Location');
  if (!location) throw new Error('Supabase 未返回上传地址');
  const uploadUrl = new URL(location, endpoint).toString();
  let offset = 0;
  onProgress?.(offset, file.size);

  while (offset < file.size) {
    const end = nextTusChunkEnd(offset, file.size, TUS_CHUNK_SIZE);
    const chunk = file.slice(offset, end);
    let completed = false;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 4 && !completed; attempt += 1) {
      try {
        const response = await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            ...authHeaders,
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: chunk,
        });

        if (response.ok) {
          const nextOffset = Number(response.headers.get('Upload-Offset'));
          offset = Number.isSafeInteger(nextOffset) && nextOffset >= end
            ? nextOffset
            : end;
          completed = true;
          onProgress?.(Math.min(offset, file.size), file.size);
          continue;
        }

        if (response.status === 409) {
          const serverOffset = await readTusOffset(uploadUrl, authHeaders);
          if (serverOffset <= offset) {
            throw new Error('上传进度发生冲突，请重新选择图片上传');
          }
          offset = serverOffset;
          completed = true;
          onProgress?.(Math.min(offset, file.size), file.size);
          continue;
        }

        if (response.status >= 500 && attempt < 3) {
          lastError = await responseError(response, '分片上传暂时失败');
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          const serverOffset = await readTusOffset(uploadUrl, authHeaders);
          if (serverOffset > offset) {
            offset = serverOffset;
            completed = true;
            onProgress?.(Math.min(offset, file.size), file.size);
          }
          continue;
        }

        throw await responseError(response, '图片分片上传失败');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('网络连接中断');
        if (attempt >= 3) break;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        try {
          const serverOffset = await readTusOffset(uploadUrl, authHeaders);
          if (serverOffset > offset) {
            offset = serverOffset;
            completed = true;
            onProgress?.(Math.min(offset, file.size), file.size);
          }
        } catch {
          // If HEAD also fails, retry the same chunk. TUS offset checks prevent
          // duplicate bytes from corrupting the object.
        }
      }
    }

    if (!completed) {
      throw lastError || new Error('图片上传中断，请重新选择文件重试');
    }
    if (offset > file.size) throw new Error('Supabase 返回的上传进度超出文件大小');
  }
}

export async function uploadImageDirect(
  file: File,
  folder: string,
  onProgress?: UploadProgress,
): Promise<string> {
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
  if (file.size > TUS_CHUNK_SIZE) {
    await uploadResumable(file, grant, onProgress);
    return grant.url;
  }

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

  onProgress?.(file.size, file.size);
  return grant.url;
}
