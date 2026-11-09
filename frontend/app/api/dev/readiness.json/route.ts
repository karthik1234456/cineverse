import { NextResponse } from 'next/server';

export async function GET() {
  if (
    process.env.NODE_ENV === 'production' &&
    !process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES
  ) {
    return NextResponse.json(
      { error: 'Developer readiness endpoint is disabled in production.' },
      { status: 404 }
    );
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://127.0.0.1:8000';

  try {
    const res = await fetch(`${backendUrl}/api/dev/readiness.json`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned HTTP ${res.status}` },
        { status: res.status }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to connect to backend' },
      { status: 500 }
    );
  }
}
