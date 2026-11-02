const MIME_EXT = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
});

const USER_FOLDERS = new Set([
  'content',
  'tutorials',
  'feedback',
  'profile-cards',
  'avatars',
]);

const ADMIN_FOLDERS = new Set([
  'games',
  'resources',
  'notices',
  'photos',
  'contributors',
  'branding',
  'backgrounds',
  'shop',
]);

export function resolveImageUploadPolicy({ folder, role, contentType, size }) {
  const safeFolder = String(folder || 'content')
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 24) || 'content';
  const extension = MIME_EXT[String(contentType || '')];

  if (!extension) {
    return { ok: false, status: 400, error: '仅支持 JPG、PNG、WEBP、GIF 图片' };
  }

  if (!Number.isSafeInteger(size) || size <= 0) {
    return { ok: false, status: 400, error: '图片文件信息无效' };
  }

  const isUserFolder = USER_FOLDERS.has(safeFolder);
  const isAdminFolder = ADMIN_FOLDERS.has(safeFolder);
  if (!isUserFolder && !isAdminFolder) {
    return { ok: false, status: 400, error: '不允许上传到该目录' };
  }
  if (isAdminFolder && role !== 'admin') {
    return { ok: false, status: 403, error: '该上传目录仅管理员可用' };
  }

  const bucket = safeFolder === 'avatars'
    ? 'avatars'
    : safeFolder === 'photos'
      ? 'photos'
      : 'content';
  const maxBytes = safeFolder === 'avatars'
    ? 4 * 1024 * 1024
    : safeFolder === 'photos'
      ? 50 * 1024 * 1024
      : 12 * 1024 * 1024;

  if (size > maxBytes) {
    return {
      ok: false,
      status: 400,
      error: `图片不能超过 ${maxBytes / 1024 / 1024} MB`,
    };
  }

  return { ok: true, folder: safeFolder, bucket, extension, maxBytes };
}
