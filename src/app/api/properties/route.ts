import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const search = searchParams.get('search') || '';
  const date = searchParams.get('date') || '2026-09-16';
  const status = searchParams.get('status') || 'ALL'; // ALL | OTA_UNDERCUT | PARITY_MATCH | DIRECT_ADVANTAGE
  const category = searchParams.get('category') || 'ALL'; // ALL | Villa | Bungalow | Mansion | Cottage etc.
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const sortBy = searchParams.get('sortBy') || 'leakage'; // leakage | name | directPrice

  const skip = (page - 1) * limit;

  try {
    // Find the latest audit run for the requested date or nearest date
    const auditRun = await prisma.auditRun.findFirst({
      where: { checkInDate: date },
      orderBy: { startedAt: 'desc' },
    }) || await prisma.auditRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });

    if (!auditRun) {
      return NextResponse.json({ properties: [], total: 0, page, pages: 0, summary: null });
    }

    // Build where clause
    const where: any = {
      auditRunId: auditRun.id,
    };

    if (status !== 'ALL') {
      where.parityStatus = status;
    }

    if (category !== 'ALL') {
      where.property = {
        categoryNormalized: category,
      };
    }

    if (search) {
      where.property = {
        ...where.property,
        OR: [
          { name: { contains: search } },
          { location: { contains: search } },
        ],
      };
    }

    // Determine orderBy
    let orderBy: any = { marginLeakage: 'desc' };
    if (sortBy === 'name') {
      orderBy = { property: { name: 'asc' } };
    } else if (sortBy === 'directPrice') {
      orderBy = { directPrice: 'desc' };
    } else if (sortBy === 'priceDiff') {
      orderBy = { priceDifference: 'desc' };
    }

    const [audits, total] = await Promise.all([
      prisma.parityAudit.findMany({
        where,
        include: {
          property: {
            include: {
              channelLinks: true,
              priceSnapshots: {
                where: { auditRunId: auditRun.id },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.parityAudit.count({ where }),
    ]);

    // Format output with channel URLs and scrapeStatuses
    const formatted = audits.map((a) => {
      const linksMap: Record<string, string> = {};
      a.property.channelLinks.forEach((l) => {
        linksMap[l.channel] = l.repairedUrl || l.url;
      });

      const channelStatuses: Record<string, string> = {};
      a.property.priceSnapshots?.forEach((ps) => {
        channelStatuses[ps.channel] = ps.scrapeStatus;
      });

      return {
        id: a.property.id,
        csvId: a.property.csvId,
        name: a.property.name,
        location: a.property.location,
        category: a.property.categoryNormalized,
        directPrice: a.directPrice,
        agodaPrice: a.agodaPrice,
        mmtPrice: a.mmtPrice,
        bookingPrice: a.bookingPrice,
        airbnbPrice: a.airbnbPrice,
        lowestOtaChannel: a.lowestOtaChannel,
        lowestOtaPrice: a.lowestOtaPrice,
        parityStatus: a.parityStatus,
        marginLeakage: a.marginLeakage,
        priceDifference: a.priceDifference,
        statusChanged: a.statusChanged,
        links: linksMap,
        channelStatuses,
      };
    });

    return NextResponse.json({
      properties: formatted,
      total,
      page,
      pages: Math.ceil(total / limit),
      auditRun: {
        id: auditRun.id,
        date: auditRun.checkInDate,
        totalAudited: auditRun.totalAudited,
        undercutCount: auditRun.undercutCount,
        parityMatchCount: auditRun.parityMatchCount,
        directAdvantageCount: auditRun.directAdvantageCount,
        totalLeakage: auditRun.totalLeakage,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
