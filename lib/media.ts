const PUBLIC_UPLOAD_MARKER = '/storage/v1/object/public/uploads/';

/**
 * Route this project's public Supabase uploads through the same-origin image proxy.
 * External image hosts and local paths are left unchanged.
 */
export function mediaUrl(value: string | null | undefined): string {
  if (!value) return '';
  if (value.startsWith('/')) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.pathname.includes(PUBLIC_UPLOAD_MARKER)) return value;
    return `/api/media?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return value;
  }
}
