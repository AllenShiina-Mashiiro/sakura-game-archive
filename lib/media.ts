const PUBLIC_STORAGE_MARKER = '/storage/v1/object/public/';

/**
 * Route this project's public Supabase uploads through the same-origin image proxy.
 * External image hosts and local paths are left unchanged.
 */
export function mediaUrl(value: string | null | undefined): string {
  if (!value) return '';
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.pathname.includes(PUBLIC_STORAGE_MARKER)) return value;
    const path = url.pathname.slice(url.pathname.indexOf(PUBLIC_STORAGE_MARKER) + PUBLIC_STORAGE_MARKER.length);
    const bucket = path.split('/')[0];
    if (!['avatars', 'content', 'photos', 'uploads'].includes(bucket)) return value;
    return `/api/media?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return value;
  }
}
