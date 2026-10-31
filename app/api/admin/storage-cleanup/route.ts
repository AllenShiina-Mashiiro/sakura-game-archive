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
const DELETE_BATCH_SIZE = 100;

function storagePathFromPhotoUrl(value: string, supabaseUrl: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const base = new URL(supabaseUrl);
    const parsed = new URL(value, base.origin);
    const prefix = '/storage/v1/object/public/uploads/';
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
    if (!path || path.split('/').some((part) => !part || part === '.' || part === '..')) return null;
    return path;
  } catch {
    return null;
  }
}

async function listAllFiles(bucket: any) {
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
      if (error) throw new Error(`读取 Storage 文件清单失败：${error.message}`);
      const entries = data || [];
      for (const entry of entries) {
        const path = folder ? folder + '/' + entry.name : entry.name;
        if (entry.id === null) {
          foldersToVisit.push(path);
        } else {
          allFiles.push(path);
          if (allFiles.length > MAX_OBJECTS) throw new Error(`文件数量超过安全上限（${MAX_OBJECTS}），已停止，未删除`);
        }
      }
      if (entries.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  }
  return allFiles;
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: '仅管理员可执行' }, { status: 403 });

    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) return NextResponse.json({ error: 'SUPABASE_URL 未配置' }, { status: 500 });

    // 执行时重新读取照片墙引用并重新扫描，不依赖旧预览结果。
    const db = await readDb();
    const keepPaths = new Set<string>();
    const unsafeReferences: Array<{ photoId: string; image: string }> = [];
    for (const photo of db.photos || []) {
      const path = storagePathFromPhotoUrl(photo.image, supabaseUrl);
      if (path) keepPaths.add(path);
      else if (photo.image) unsafeReferences.push({ photoId: photo.id, image: photo.image });
    }
    if (unsafeReferences.length) {
      return NextResponse.json({
        ok: false,
        error: '照片墙存在无法识别的图片引用，已安全停止；没有删除任何文件。',
        unsafePhotoReferences: unsafeReferences.slice(0, 30),
      }, { status: 409 });
    }

    const supabase = getSupabaseAdmin();
    const bucket = supabase.storage.from('uploads');
    const allFiles = await listAllFiles(bucket);
    const imageFiles = allFiles.filter((path) => IMAGE_EXTENSIONS.has(path.split('.').pop()?.toLowerCase() || ''));
    const keepImages = imageFiles.filter((path) => keepPaths.has(path));
    const deleteImages = imageFiles.filter((path) => !keepPaths.has(path));

    // 照片墙引用的图片必须仍然存在；若引用文件缺失也停止，避免误报成功。
    const missingKeptFiles = [...keepPaths].filter((path) => !allFiles.includes(path));
    if (missingKeptFiles.length) {
      return NextResponse.json({
        ok: false,
        error: '照片墙引用的图片文件在 Storage 清单中不存在，已停止删除。',
        missingKeptFiles: missingKeptFiles.slice(0, 30),
      }, { status: 409 });
    }

    const deleted: string[] = [];
    for (let i = 0; i < deleteImages.length; i += DELETE_BATCH_SIZE) {
      const batch = deleteImages.slice(i, i + DELETE_BATCH_SIZE);
      const { data, error } = await bucket.remove(batch);
      if (error) {
        return NextResponse.json({
          ok: false,
          error: 'Storage 图片删除过程中失败，数据库尚未重置。可能已有部分图片删除。',
          details: error.message,
          deletedCount: deleted.length,
          expectedDeleteCount: deleteImages.length,
          failedBatch: batch,
        }, { status: 500 });
      }
      const removed = new Set((data || []).map((item: { name: string }) => item.name));
      const confirmed = batch.filter((path) => removed.has(path));
      if (confirmed.length !== batch.length) {
        return NextResponse.json({
          ok: false,
          error: 'Storage 返回的删除结果与请求数量不一致，已停止后续删除；数据库尚未重置。',
          deletedCount: deleted.length + confirmed.length,
          expectedDeleteCount: deleteImages.length,
          unconfirmedBatchPaths: batch.filter((path) => !removed.has(path)),
        }, { status: 500 });
      }
      deleted.push(...confirmed);
    }

    return NextResponse.json({
      ok: true,
      bucket: 'uploads',
      deletedCount: deleted.length,
      expectedDeleteCount: deleteImages.length,
      keptPhotoWallImages: keepImages.length,
      preservedNonImageFiles: allFiles.length - imageFiles.length,
      deletedSamples: deleted.slice(0, 50),
      message: 'Storage 图片清理完成。数据库尚未重置；请核对 deletedCount 与 expectedDeleteCount 相同后，再单独执行数据库重置。',
    });
  } catch (error) {
    console.error('Storage 图片清理失败:', error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Storage 图片清理失败',
      message: '数据库尚未重置。',
    }, { status: 500 });
  }
}
