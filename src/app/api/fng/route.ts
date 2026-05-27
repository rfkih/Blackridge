import { NextResponse } from 'next/server';

const UPSTREAM = 'https://api.alternative.me/fng/?limit=2';

export async function GET() {
  let res: Response;
  try {
    res = await fetch(UPSTREAM, { next: { revalidate: 3600 } });
  } catch {
    return NextResponse.json({ error: 'upstream unreachable' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `upstream ${res.status}` }, { status: 502 });
  }

  const data: unknown = await res.json();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
  });
}
