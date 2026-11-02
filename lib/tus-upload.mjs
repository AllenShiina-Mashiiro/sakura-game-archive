const DEFAULT_TUS_CHUNK_SIZE = 6 * 1024 * 1024;

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(String(value));
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function encodeTusMetadata(metadata) {
  return Object.entries(metadata)
    .map(([key, value]) => `${key} ${encodeBase64Utf8(value)}`)
    .join(',');
}

export function buildTusUploadEndpoint(supabaseUrl) {
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('Supabase Storage 上传地址必须使用 HTTPS');
  }

  const hostname = url.hostname.endsWith('.storage.supabase.co')
    ? url.hostname
    : url.hostname.replace(/\.supabase\.co$/i, '.storage.supabase.co');
  if (hostname === url.hostname && !hostname.endsWith('.storage.supabase.co')) {
    throw new Error('无法识别 Supabase Storage 上传域名');
  }

  return `${url.protocol}//${hostname}/storage/v1/upload/resumable`;
}

export function nextTusChunkEnd(offset, totalSize, chunkSize = DEFAULT_TUS_CHUNK_SIZE) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(totalSize)
    || !Number.isSafeInteger(chunkSize) || offset < 0 || totalSize < 0 || chunkSize <= 0
    || offset > totalSize) {
    throw new RangeError('Invalid TUS chunk range');
  }
  return Math.min(totalSize, offset + chunkSize);
}

export const TUS_CHUNK_SIZE = DEFAULT_TUS_CHUNK_SIZE;
