import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_UPLOAD_PREFIX = '/storage/v1/object/public/uploads/';

function resolveAllowedSource(raw: string) {
  const configured = process.env.SUPABASE_URL;
  if (!configured) throw new Error('SUPABASE_URL is not configured');
  const base = new URL(configured);
  const source = new URL(raw);
  if (source.protocol !== 'https:' || source.origin !== base.origin) {
    throw new Error('Image host is not allowed');
  }
  if (!source.pathname.startsWith(PUBLIC_UPLOAD_PREFIX)) {
    throw new Error('Only public uploads are allowed');
  }
  const objectPath = source.pathname.slice(PUBLIC_UPLOAD_PREFIX.length);
  const decoded = decodeURIComponent(objectPath);
  if (!decoded || decoded.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Invalid storage object path');
  }
  return source;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw || raw.length > 4096) return NextResponse.json({ error: 'Missing or invalid image URL' }, { status: 400 });
  let source: URL;
  try {
    source = resolveAllowedSource(raw);
  } catch {
    return NextResponse.json({ error: 'Image source is not allowed' }, { status: 403 });
  }

  try {
    const upstream = await fetch(source, {
      method: 'GET',
      redirect: 'error',
      headers: { Accept: request.headers.get('accept') || 'image/avif,image/webp,image/*,*/*;q=0.8' },
      signal: AbortSignal.timeout(15000),
      cache: 'force-cache',
      next: { revalidate: 3600 },
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'Image source unavailable' }, { status: upstream.status || 502 });
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return NextResponse.json({ error: 'Source did not return an image' }, { status: 415 });
    }
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    headers.set('X-Content-Type-Options', 'nosniff');
    const length = upstream.headers.get('content-length');
    if (length) headers.set('Content-Length', length);
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: 'Image proxy request failed' }, { status: 502 });
  }
}
