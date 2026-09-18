import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActiveJob } from '@/lib/auditRunner';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }

  const run = await prisma.auditRun.findUnique({
    where: { id: runId },
  });

  if (!run) {
    return NextResponse.json({ error: 'Audit run not found' }, { status: 404 });
  }

  const activeJob = getActiveJob(runId);
  const processedCount = activeJob ? activeJob.processedCount : run.processedCount;
  const totalAudited = run.totalAudited || 1;
  const progressPercent = Math.min(100, Math.round((processedCount / totalAudited) * 100));

  return NextResponse.json({
    id: run.id,
    status: run.status,
    mode: run.mode,
    checkInDate: run.checkInDate,
    checkOutDate: run.checkOutDate,
    processedCount,
    totalAudited,
    progressPercent,
    undercutCount: run.undercutCount,
    parityMatchCount: run.parityMatchCount,
    directAdvantageCount: run.directAdvantageCount,
    totalLeakage: run.totalLeakage,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    channelStats: activeJob?.channelStats || null,
  });
}
