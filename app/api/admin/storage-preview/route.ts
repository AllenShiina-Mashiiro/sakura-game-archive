import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { readDb } from '@/lib/db';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg',
  'bmp', 'tif', 'tiff', 'ico',
]);
const PAGE_SIZE = 1000;
const MAX_OBJECTS = 50000;

function storagePathFromPhotoUrl(value: string, supabaseUrl: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const base = new URL(supabaseUrl);
  const prefix = '/storage/v1/object/public/uploads/';
  try {
    const parsed = new URL(value, base.origin);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(prefix)) return null;
    const encodedPath = parsed.pathname.slice(prefix.length);
    const path = decodeURIComponent(encodedPath);
    if (!path || path.split('/').some((part) => !part || part === '.' || part === '..')) return null;
    return path;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '仅管理员可执行' }, { status: 403 });

    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) return NextResponse.json({ error: 'SUPABASE_URL 未配置' }, { status: 500 });

    const db = await readDb();
    const keepPaths = new Set<string>();
    const unsafePhotoReferences: Array<{ photoId: string; image: string }> = [];
    for (const photo of db.photos || []) {
      const path = storagePathFromPhotoUrl(photo.image, supabaseUrl);
      if (path) keepPaths.add(path);
      else if (photo.image) unsafePhotoReferences.push({ photoId: photo.id, image: photo.image });
    }

    const supabase = getSupabaseAdmin();
    const bucket = supabase.storage.from('uploads');
    const allFiles: string[] = [];
    const foldersToVisit = [''];
    while (foldersToVisit.length) {
      const folder = foldersToVisit.shift()!;
      let offset = 0;
      while (true) {
        const { data, error } = await bucket.list(folder, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        });
        if (error) {
          return NextResponse.json({
            error: '读取 Storage 文件清单失败，未执行任何删除',
            details: error.message,
            scannedFiles: allFiles.length,
          }, { status: 500 });
        }
        const entries = data || [];
        for (const entry of entries) {
          const path = folder ? folder + '/' + entry.name : entry.name;
          if (entry.id === null) {
            foldersToVisit.push(path);
          } else {
            allFiles.push(path);
            if (allFiles.length > MAX_OBJECTS) {
              return NextResponse.json({
                error: '文件数量超过安全预览上限，已停止扫描，未执行任何删除',
                maxObjects: MAX_OBJECTS,
              }, { status: 413 });
            }
          }
        }
        if (entries.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }

    const imageFiles = allFiles.filter((path) => {
      const ext = path.split('.').pop()?.toLowerCase() || '';
      return IMAGE_EXTENSIONS.has(ext);
    });
    const keptImages = imageFiles.filter((path) => keepPaths.has(path));
    const deleteImages = imageFiles.filter((path) => !keepPaths.has(path));

    return NextResponse.json({
      ok: true,
      bucket: 'uploads',
      scannedAt: new Date().toISOString(),
      totalFiles: allFiles.length,
      totalImageFiles: imageFiles.length,
      keepPhotoWallImages: keptImages.length,
      deleteImageFiles: deleteImages.length,
      nonImageFilesPreserved: allFiles.length - imageFiles.length,
      unsafePhotoReferences: unsafePhotoReferences.length,
      safeToProceed: unsafePhotoReferences.length === 0,
      keepSamples: keptImages.slice(0, 30),
      deleteSamples: deleteImages.slice(0, 50),
      nonImageSamples: allFiles.filter((path) => !imageFiles.includes(path)).slice(0, 20),
      unsafeReferences: unsafePhotoReferences.slice(0, 20),
      note: '本接口仅预览，不会删除 Storage 文件或修改数据库。只有 safeToProceed 为 true 且经用户最终确认后，才可进入删除步骤。',
    });
  } catch (error) {
    console.error('Storage 预览失败:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Storage 预览失败',
    }, { status: 500 });
  }
}
