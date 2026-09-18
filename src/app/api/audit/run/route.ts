import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startAuditRun } from '@/lib/auditRunner';

export const dynamic = 'force-dynamic';

export async function GET() {
  const latestRuns = await prisma.auditRun.findMany({
    take: 5,
    orderBy: { startedAt: 'desc' },
  });
  return NextResponse.json({ status: 'Audit engine active', latestRuns });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const checkInDate = body.checkInDate || new Date().toISOString().split('T')[0];

    const nextDay = new Date(checkInDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const checkOutDate = body.checkOutDate || nextDay.toISOString().split('T')[0];

    const mode = (body.mode as 'FULL' | 'INCREMENTAL') || 'FULL';
    const limit = body.limit ? parseInt(body.limit, 10) : undefined;
    const region = body.region || undefined;

    const propertyCount = await prisma.property.count({
      where: region ? { location: { contains: region } } : undefined,
    });

    if (propertyCount === 0) {
      return NextResponse.json({ error: 'No properties found for audit.' }, { status: 400 });
    }

    const totalAudited = limit ? Math.min(limit, propertyCount) : propertyCount;

    // 1. Create AuditRun record with RUNNING status
    const auditRun = await prisma.auditRun.create({
      data: {
        status: 'RUNNING',
        triggeredBy: body.triggeredBy || 'MANUAL_DASHBOARD',
        mode,
        checkInDate,
        checkOutDate,
        totalAudited,
        processedCount: 0,
      },
    });

    // 2. Start background worker asynchronously
    await startAuditRun(auditRun.id, {
      checkInDate,
      checkOutDate,
      mode,
      limit,
      region,
    });

    // 3. Return immediately with runId
    return NextResponse.json({
      success: true,
      runId: auditRun.id,
      status: 'RUNNING',
      mode,
      checkInDate,
      checkOutDate,
      totalAudited,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to start audit run' }, { status: 500 });
  }
}
