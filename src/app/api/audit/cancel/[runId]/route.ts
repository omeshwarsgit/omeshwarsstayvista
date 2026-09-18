import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cancelAuditRun } from '@/lib/auditRunner';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  if (!runId) {
    return NextResponse.json({ error: 'runId is required' }, { status: 400 });
  }

  const cancelledInMemory = cancelAuditRun(runId);

  await prisma.auditRun.update({
    where: { id: runId },
    data: { status: 'CANCELLED' },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    cancelled: cancelledInMemory,
    message: 'Audit run cancellation requested',
  });
}
