import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') || '2026-09-16';

  try {
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        channelLinks: true,
      },
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Find audit for specified date or latest date
    const auditRun = await prisma.auditRun.findFirst({
      where: { checkInDate: date },
      orderBy: { startedAt: 'desc' },
    }) || await prisma.auditRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    let parityAudit = null;
    let priceSnapshots: any[] = [];

    if (auditRun) {
      parityAudit = await prisma.parityAudit.findFirst({
        where: {
          auditRunId: auditRun.id,
          propertyId: id,
        },
      });

      priceSnapshots = await prisma.priceSnapshot.findMany({
        where: {
          auditRunId: auditRun.id,
          propertyId: id,
        },
      });
    }

    // Historical price trends across all audit runs for this property
    const historicalAudits = await prisma.parityAudit.findMany({
      where: { propertyId: id },
      include: {
        auditRun: true,
      },
      orderBy: { date: 'asc' },
    });

    const linksMap: Record<string, any> = {};
    property.channelLinks.forEach((l) => {
      linksMap[l.channel] = {
        url: l.repairedUrl || l.url,
        originalUrl: l.url,
        repairedUrl: l.repairedUrl,
        linkStatus: l.linkStatus,
        lastValidatedAt: l.lastValidatedAt,
      };
    });

    return NextResponse.json({
      property: {
        id: property.id,
        csvId: property.csvId,
        primaryPropertyId: property.primaryPropertyId,
        name: property.name,
        location: property.location,
        categoryNormalized: property.categoryNormalized,
        basePrice: property.basePrice,
        links: linksMap,
      },
      parityAudit,
      priceSnapshots,
      history: historicalAudits.map((h) => ({
        date: h.date,
        directPrice: h.directPrice,
        agodaPrice: h.agodaPrice,
        mmtPrice: h.mmtPrice,
        bookingPrice: h.bookingPrice,
        airbnbPrice: h.airbnbPrice,
        parityStatus: h.parityStatus,
        marginLeakage: h.marginLeakage,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
