import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auditRuns = await prisma.auditRun.findMany({
      orderBy: { checkInDate: 'asc' },
    });

    const calendarData = auditRuns.map((run) => {
      const total = run.totalAudited || 1187;
      const healthy = run.parityMatchCount + run.directAdvantageCount;
      const healthScore = total > 0 ? Math.round((healthy / total) * 100) : 100;

      return {
        id: run.id,
        date: run.checkInDate,
        checkOutDate: run.checkOutDate,
        totalAudited: run.totalAudited,
        undercutCount: run.undercutCount,
        parityMatchCount: run.parityMatchCount,
        directAdvantageCount: run.directAdvantageCount,
        totalLeakage: run.totalLeakage,
        healthScore,
        status: run.status,
      };
    });

    return NextResponse.json({ dates: calendarData });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
