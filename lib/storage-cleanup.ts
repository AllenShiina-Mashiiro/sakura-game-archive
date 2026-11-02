import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { readDb } from '@/lib/db';

const OWNED_BUCKETS = new Set(['uploads', 'content', 'avatars', 'photos']);

type StorageObject = { bucket: string; path: string };

function extractOwnedStorageObject(value: string): StorageObject | null {
  try {
    const url = new URL(value);
    const configuredUrl = process.env.SUPABASE_URL;
    if (!configuredUrl || url.origin !== new URL(configuredUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match || !OWNED_BUCKETS.has(match[1])) return null;
    const path = decodeURIComponent(match[2]);
    if (!path || path.split('/').some((part) => !part || part === '.' || part === '..')) return null;
    return { bucket: match[1], path };
  } catch {
    return null;
  }
}

function collectStrings(value: unknown, output: Set<string>, seen = new Set<object>()) {
  if (typeof value === 'string') {
    // Also catches image URLs embedded in HTML/Markdown content.
    const matches = value.match(/https?:\/\/[^\s"'<>]+/g) || [];
    for (const match of matches) {
      const clean = match.replace(/[),.;]+$/, '');
      if (extractOwnedStorageObject(clean)) output.add(clean);
    }
    if (extractOwnedStorageObject(value)) output.add(value);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value as object)) return;
  seen.add(value as object);
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output, seen);
  } else {
    for (const item of Object.values(value as Record<string, unknown>)) collectStrings(item, output, seen);
  }
}

/**
 * Deletes only project-owned public uploads that are no longer referenced in
 * app_state. Handles both legacy uploads and the newer size-limited buckets.
 * Database changes must be committed first.
 */
export async function deleteUnreferencedStorageImages(candidates: unknown[]) {
  const candidateUrls = new Set<string>();
  for (const candidate of candidates) collectStrings(candidate, candidateUrls);
  if (!candidateUrls.size) return { deleted: 0, skipped: 0 };

  const db = await readDb();
  const referenced = new Set<string>();
  collectStrings(db, referenced);

  const unreferenced = [...candidateUrls].filter((url) => !referenced.has(url));
  const grouped = new Map<string, string[]>();
  for (const url of unreferenced) {
    const object = extractOwnedStorageObject(url);
    if (!object) continue;
    const paths = grouped.get(object.bucket) || [];
    paths.push(object.path);
    grouped.set(object.bucket, paths);
  }

  if (!grouped.size) return { deleted: 0, skipped: candidateUrls.size };

  const supabase = getSupabaseAdmin();
  let deleted = 0;
  for (const [bucket, paths] of grouped) {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        console.error('Supabase 孤立图片清理失败:', error.message, { bucket, batch });
        throw new Error('数据已保存，但旧图片清理失败；请稍后重试清理。');
      }
      deleted += batch.length;
    }
  }
  return { deleted, skipped: candidateUrls.size - deleted };
}
