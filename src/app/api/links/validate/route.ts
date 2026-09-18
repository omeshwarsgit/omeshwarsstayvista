import { NextResponse } from 'next/server';
import { validateChannelLinksBatch } from '@/lib/linkValidator';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit ? parseInt(body.limit, 10) : 25;
    const offset = body.offset ? parseInt(body.offset, 10) : 0;
    const channel = body.channel || undefined;
    const propertyId = body.propertyId || undefined;
    const onlyUnchecked = body.onlyUnchecked !== false;

    const result = await validateChannelLinksBatch({
      limit,
      offset,
      channel,
      propertyId,
      onlyUnchecked,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Validation failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') || undefined;
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const result = await validateChannelLinksBatch({
    limit,
    channel,
  });

  return NextResponse.json(result);
}
