/**
 * Accept only Supabase publishable keys or legacy anon JWT keys.
 * In particular, never echo a service_role JWT into a browser response.
 */
export function isSupabasePublicKey(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const key = value.trim();
  if (key.startsWith('sb_publishable_')) return true;

  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return payload?.role === 'anon';
  } catch {
    return false;
  }
}
