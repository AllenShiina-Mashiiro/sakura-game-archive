import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { readDb } from '@/lib/db';

const BUCKET = 'uploads';
const PUBLIC_PREFIX = '/storage/v1/object/public/uploads/';

function extractOwnedStoragePath(value: string): string | null {
  try {
    const url = new URL(value);
    const configuredUrl = process.env.SUPABASE_URL;
    if (!configuredUrl || url.origin !== new URL(configuredUrl).origin) return null;
    if (!url.pathname.startsWith(PUBLIC_PREFIX)) return null;
    const path = decodeURIComponent(url.pathname.slice(PUBLIC_PREFIX.length));
    if (!path || path.split('/').some((part) => !part || part === '.' || part === '..')) return null;
    return path;
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
      if (extractOwnedStoragePath(clean)) output.add(clean);
    }
    if (extractOwnedStoragePath(value)) output.add(value);
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
 * Deletes only uploads owned by this project and no longer referenced anywhere
 * in the current app_state JSON. Database changes must be committed first.
 */
export async function deleteUnreferencedStorageImages(candidates: unknown[]) {
  const candidateUrls = new Set<string>();
  for (const candidate of candidates) collectStrings(candidate, candidateUrls);
  if (!candidateUrls.size) return { deleted: 0, skipped: 0 };

  const db = await readDb();
  const referenced = new Set<string>();
  collectStrings(db, referenced);

  const paths = [...candidateUrls]
    .filter((url) => !referenced.has(url))
    .map((url) => extractOwnedStoragePath(url))
    .filter((path): path is string => Boolean(path));

  if (!paths.length) return { deleted: 0, skipped: candidateUrls.size };

  const supabase = getSupabaseAdmin();
  let deleted = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error('Supabase 孤立图片清理失败:', error.message, batch);
      throw new Error('数据已保存，但旧图片清理失败；请稍后重试清理。');
    }
    deleted += batch.length;
  }
  return { deleted, skipped: candidateUrls.size - paths.length };
}
